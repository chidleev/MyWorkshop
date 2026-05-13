import type { PoolConnection } from "mysql2/promise";
import { dbPool } from "../config/db";
import { AppError } from "../utils/AppError";
import type { ParsedSpecificationItem } from "../types/auth";

interface MaterialRow {
  id: number;
  article: string;
  name: string;
  base_cost: string;
}

interface PreparedItem {
  material_id: number;
  article: string;
  name: string;
  required_quantity: number;
  base_cost: number;
  sale_price: number;
}

export interface SpecificationLinePayload {
  row_id: string;
  article: string;
  name: string;
  required_quantity: string;
  unit_price: string;
  amount: string;
  missing_material: boolean;
}

interface OkRow {
  status: "ok";
  material_id: number;
  article: string;
  name: string;
  required_quantity: number;
  base_cost: number;
  sale_price: number;
}

interface MissingRow {
  status: "missing";
  article: string;
  quantity: number;
}

export type ClassifiedSpecificationRow = OkRow | MissingRow;

export const PRICING_MARKUP_MODES = ["none", "percent", "fixed", "coefficient", "margin_on_price"] as const;
export type PricingMarkupMode = (typeof PRICING_MARKUP_MODES)[number];

export function parsePricingMarkupMode(raw: string | null | undefined): PricingMarkupMode {
  const v = String(raw ?? "").trim();
  if ((PRICING_MARKUP_MODES as readonly string[]).includes(v)) {
    return v as PricingMarkupMode;
  }
  return "none";
}

/** Итоговая цена заказа (клиенту) и сумма наценки поверх суммы материалов по прайсу. */
export function computeClientTotalWithMarkup(
  materialsSubtotal: number,
  mode: PricingMarkupMode,
  rawValue: number
): { clientTotal: number; markupAmount: number } {
  const m = Number(Number(materialsSubtotal).toFixed(2));
  if (!Number.isFinite(m) || m < 0) {
    return { clientTotal: 0, markupAmount: 0 };
  }
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    return { clientTotal: m, markupAmount: 0 };
  }

  let client: number;
  switch (mode) {
    case "percent":
      client = m * (1 + Math.max(0, value) / 100);
      break;
    case "fixed":
      client = m + Math.max(0, value);
      break;
    case "coefficient": {
      const k = value > 0 ? value : 1;
      client = m * k;
      break;
    }
    case "margin_on_price": {
      const p = Math.min(99.99, Math.max(0, value));
      if (p <= 0 || m === 0) {
        client = m;
      } else if (p >= 100) {
        client = m;
      } else {
        client = m / (1 - p / 100);
      }
      break;
    }
    case "none":
    default:
      client = m;
      break;
  }

  if (!Number.isFinite(client) || client < 0) {
    client = 0;
  }
  const clientTotal = Number(client.toFixed(2));
  const markupAmount = Number((clientTotal - m).toFixed(2));
  return { clientTotal, markupAmount };
}

export function validatePricingMarkupValue(mode: PricingMarkupMode, value: number): void {
  if (!Number.isFinite(value)) {
    throw new AppError(400, "Некорректное значение наценки");
  }
  switch (mode) {
    case "none":
      return;
    case "percent":
    case "fixed":
      if (value < 0) {
        throw new AppError(400, "Значение не может быть отрицательным");
      }
      return;
    case "coefficient":
      if (value <= 0) {
        throw new AppError(400, "Коэффициент должен быть больше нуля");
      }
      return;
    case "margin_on_price":
      if (value < 0 || value >= 100) {
        throw new AppError(400, "Маржа от цены продажи должна быть от 0 до 100 (не включая 100)");
      }
      return;
    default:
      return;
  }
}

export class PricingService {
  static async classifyParsedItems(items: ParsedSpecificationItem[]): Promise<ClassifiedSpecificationRow[]> {
    if (items.length === 0) {
      return [];
    }

    const uniqueArticles = [...new Set(items.map((item) => item.article))];
    const placeholders = uniqueArticles.map(() => "?").join(",");
    const [rows] = await dbPool.query(
      `SELECT id, article, name, base_cost FROM materials WHERE article IN (${placeholders})`,
      uniqueArticles
    );

    const materialMap = new Map<string, MaterialRow>();
    (rows as MaterialRow[]).forEach((row) => materialMap.set(row.article, row));

    return items.map((item) => {
      const material = materialMap.get(item.article);
      if (!material) {
        return { status: "missing", article: item.article, quantity: item.quantity } satisfies MissingRow;
      }
      const baseCost = Number(material.base_cost);
      const salePrice = Number((item.quantity * baseCost).toFixed(2));
      return {
        status: "ok",
        material_id: material.id,
        article: material.article,
        name: material.name,
        required_quantity: Number(item.quantity.toFixed(3)),
        base_cost: baseCost,
        sale_price: salePrice
      } satisfies OkRow;
    });
  }

  static buildSpecificationPayload(classified: ClassifiedSpecificationRow[]): {
    lines: SpecificationLinePayload[];
    hasMissing: boolean;
    totalCost: number;
  } {
    let totalCost = 0;
    const lines: SpecificationLinePayload[] = classified.map((row, index) => {
      if (row.status === "missing") {
        return {
          row_id: `row-${index}`,
          article: row.article,
          name: "—",
          required_quantity: Number(row.quantity.toFixed(3)).toFixed(3),
          unit_price: "",
          amount: "",
          missing_material: true
        };
      }
      totalCost += row.sale_price;
      return {
        row_id: `row-${index}`,
        article: row.article,
        name: row.name,
        required_quantity: row.required_quantity.toFixed(3),
        unit_price: row.base_cost.toFixed(2),
        amount: row.sale_price.toFixed(2),
        missing_material: false
      };
    });

    return {
      lines,
      hasMissing: classified.some((row) => row.status === "missing"),
      totalCost: Number(totalCost.toFixed(2))
    };
  }

  static async enrichWithMaterialPrices(items: ParsedSpecificationItem[]): Promise<PreparedItem[]> {
    const classified = await this.classifyParsedItems(items);
    const missing = classified.find((row) => row.status === "missing");
    if (missing) {
      throw new AppError(400, `Артикул ${missing.article} не найден в складской номенклатуре`);
    }
    return this.classifiedToPreparedItems(classified);
  }

  static classifiedToPreparedItems(classified: ClassifiedSpecificationRow[]): PreparedItem[] {
    const missing = classified.find((row) => row.status === "missing");
    if (missing) {
      throw new AppError(400, "Имеются позиции без номенклатуры в базе");
    }

    return (classified as OkRow[]).map((row) => ({
      material_id: row.material_id,
      article: row.article,
      name: row.name,
      required_quantity: row.required_quantity,
      base_cost: row.base_cost,
      sale_price: row.sale_price
    }));
  }

  static async saveSpecification(orderId: number, preparedItems: PreparedItem[], connection: PoolConnection): Promise<number> {
    await connection.query("DELETE FROM specification_items WHERE order_id = ?", [orderId]);
    if (preparedItems.length === 0) {
      return 0;
    }

    const values = preparedItems.map((item) => [orderId, item.material_id, item.required_quantity, item.sale_price]);
    await connection.query(
      "INSERT INTO specification_items (order_id, material_id, required_quantity, sale_price) VALUES ?",
      [values]
    );

    return Number(preparedItems.reduce((acc, item) => acc + item.sale_price, 0).toFixed(2));
  }
}
