import type { PoolConnection } from "mysql2/promise";
import { dbPool } from "../config/db";
import { AppError } from "../utils/AppError";
import type { ParsedSpecificationItem } from "../types/auth";

interface MaterialRow {
  id: number;
  article: string;
  base_cost: string;
}

interface PreparedItem {
  material_id: number;
  required_quantity: number;
  base_cost: number;
  sale_price: number;
}

export class PricingService {
  static async enrichWithMaterialPrices(items: ParsedSpecificationItem[]): Promise<PreparedItem[]> {
    const uniqueArticles = [...new Set(items.map((item) => item.article))];
    if (uniqueArticles.length === 0) {
      return [];
    }

    const placeholders = uniqueArticles.map(() => "?").join(",");
    const [rows] = await dbPool.query(
      `SELECT id, article, base_cost FROM materials WHERE article IN (${placeholders})`,
      uniqueArticles
    );

    const materialMap = new Map<string, MaterialRow>();
    (rows as MaterialRow[]).forEach((row) => materialMap.set(row.article, row));

    return items.map((item) => {
      const material = materialMap.get(item.article);
      if (!material) {
        throw new AppError(400, `Артикул ${item.article} не найден в складской номенклатуре`);
      }
      const baseCost = Number(material.base_cost);
      const salePrice = Number((item.quantity * baseCost).toFixed(2));
      return {
        material_id: material.id,
        required_quantity: Number(item.quantity.toFixed(3)),
        base_cost: baseCost,
        sale_price: salePrice
      };
    });
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
