import type { PoolConnection } from "mysql2/promise";
import type { Request, Response } from "express";
import type { ResultSetHeader } from "mysql2";
import multer from "multer";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { dbPool } from "../config/db";
import { AppError } from "../utils/AppError";
import { parseSpecificationCsv } from "../services/SpecificationParser";
import {
  PricingService,
  type ClassifiedSpecificationRow,
  type SpecificationLinePayload,
  computeClientTotalWithMarkup,
  parsePricingMarkupMode,
  validatePricingMarkupValue,
  type PricingMarkupMode
} from "../services/PricingService";
import type { ParsedSpecificationItem } from "../types/auth";
import { InventoryService } from "../services/InventoryService";
import { StatusManager } from "../services/StatusManager";
import { NotificationService } from "../services/NotificationService";
import { documentsPath, uploadsPath } from "../config/paths";

function resolveManagedFilePath(secureLink: string): string | null {
  const normalized = secureLink.trim().replace(/^\/+/, "");
  const posixNormalized = path.posix.normalize(normalized);
  if (posixNormalized.startsWith("../")) {
    return null;
  }

  if (posixNormalized.startsWith("uploads/")) {
    const relativePath = posixNormalized.slice("uploads/".length);
    const absolutePath = path.resolve(uploadsPath, relativePath);
    if (!absolutePath.startsWith(uploadsPath)) return null;
    return absolutePath;
  }

  if (posixNormalized.startsWith("documents/")) {
    const relativePath = posixNormalized.slice("documents/".length);
    const absolutePath = path.resolve(documentsPath, relativePath);
    if (!absolutePath.startsWith(documentsPath)) return null;
    return absolutePath;
  }

  return null;
}

async function removeManagedFiles(secureLinks: string[]): Promise<void> {
  for (const secureLink of secureLinks) {
    const filePath = resolveManagedFilePath(secureLink);
    if (!filePath) {
      continue;
    }
    try {
      await fs.unlink(filePath);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }
}

/** Внутренний номер заказа при автогенерации: MM-ГГГГ-NNNN (NNNN — id заказа). */
function formatAutoAgreementNumber(orderId: number, year = new Date().getFullYear()): string {
  return `MM-${year}-${String(orderId).padStart(4, "0")}`;
}

const optionalNonEmptyString = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
  z.string().trim().min(1).optional()
);

const createOrderSchema = z.object({
  full_name: z.string().trim().min(1),
  phone: z.preprocess((val) => {
    if (val === undefined || val === null) return "";
    return String(val).trim();
  }, z.string()),
  email: z.string().trim().email(),
  address: z.string().trim().optional(),
  agreement_number: optionalNonEmptyString,
  target_date: z.string().optional(),
  manager_ext_id: z.string().trim().min(1).optional()
});

const claimWebApplicationSchema = z.object({
  agreement_number: optionalNonEmptyString,
  target_date: z.string().min(1),
  full_name: z.string().trim().min(1).optional(),
  phone: z.preprocess((val) => {
    if (val === undefined || val === null) return "";
    return String(val).trim();
  }, z.string()),
  email: z.string().trim().email(),
  address: z.string().trim().optional()
});

const specificationRowsSchema = z.object({
  rows: z.array(
    z.object({
      article: z.string().trim().min(1),
      quantity: z.number().positive()
    })
  )
});

const pricingMarkupModeSchema = z.enum(["none", "percent", "fixed", "coefficient", "margin_on_price"]);

const pricingMarkupPatchSchema = z.object({
  pricing_markup_mode: pricingMarkupModeSchema,
  pricing_markup_value: z.number().finite()
});

type SpecificationMutationPayload = {
  committed: boolean;
  total_cost: string;
  materials_subtotal: string;
  pricing_markup_mode: PricingMarkupMode;
  pricing_markup_value: string;
  markup_amount: string;
  items: SpecificationLinePayload[];
  has_missing_materials: boolean;
};

function buildSpecificationMutationPayload(
  committed: boolean,
  materialsSubtotal: number,
  mode: PricingMarkupMode,
  value: number,
  lines: SpecificationLinePayload[],
  hasMissing: boolean
): SpecificationMutationPayload {
  const { clientTotal, markupAmount } = computeClientTotalWithMarkup(materialsSubtotal, mode, value);
  return {
    committed,
    materials_subtotal: materialsSubtotal.toFixed(2),
    pricing_markup_mode: mode,
    pricing_markup_value: String(value),
    markup_amount: markupAmount.toFixed(2),
    total_cost: clientTotal.toFixed(2),
    items: lines,
    has_missing_materials: hasMissing
  };
}

async function readOrderMarkup(orderId: number): Promise<{ mode: PricingMarkupMode; value: number }> {
  const [rows] = await dbPool.query(
    "SELECT pricing_markup_mode, pricing_markup_value FROM orders WHERE id = ? LIMIT 1",
    [orderId]
  );
  const row = (rows as Array<{ pricing_markup_mode: string | null; pricing_markup_value: string | number | null }>)[0];
  if (!row) {
    return { mode: "none", value: 0 };
  }
  return {
    mode: parsePricingMarkupMode(row.pricing_markup_mode),
    value: Number(row.pricing_markup_value ?? 0)
  };
}

async function readOrderMarkupFromConnection(connection: PoolConnection, orderId: number): Promise<{ mode: PricingMarkupMode; value: number }> {
  const [rows] = await connection.query(
    "SELECT pricing_markup_mode, pricing_markup_value FROM orders WHERE id = ? LIMIT 1",
    [orderId]
  );
  const row = (rows as Array<{ pricing_markup_mode: string | null; pricing_markup_value: string | number | null }>)[0];
  if (!row) {
    return { mode: "none", value: 0 };
  }
  return {
    mode: parsePricingMarkupMode(row.pricing_markup_mode),
    value: Number(row.pricing_markup_value ?? 0)
  };
}

async function evaluateSpecificationRows(parsedItems: ParsedSpecificationItem[]): Promise<{
  classified: ClassifiedSpecificationRow[];
  lines: SpecificationLinePayload[];
  hasMissing: boolean;
  totalCost: number;
}> {
  const classified = await PricingService.classifyParsedItems(parsedItems);
  const built = PricingService.buildSpecificationPayload(classified);
  return {
    classified,
    lines: built.lines,
    hasMissing: built.hasMissing,
    totalCost: built.totalCost
  };
}

export const specificationUpload = multer({ storage: multer.memoryStorage() });
export const mediaUpload = multer({
  storage: multer.diskStorage({
    destination: uploadsPath,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`)
  }),
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png"].includes(file.mimetype)) cb(null, true);
    else cb(new AppError(400, "Разрешены только изображения JPEG/PNG"));
  }
});

export class OrderController {
  static async createOrder(req: Request, res: Response): Promise<void> {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "Ошибка валидации");

    const actorId = req.user?.id;
    if (!actorId) throw new AppError(401, "Недействительный токен");

    const { full_name, phone, email, address, agreement_number, target_date, manager_ext_id } = parsed.data;
    const managerId = req.user?.role === "Руководитель" ? manager_ext_id ?? actorId : actorId;
    const phoneValue = phone ? phone : null;
    const agreementTrimmed = agreement_number?.trim();
    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();
      const [clientResult] = await connection.query<ResultSetHeader>(
        "INSERT INTO clients (full_name, phone, email, address) VALUES (?, ?, ?, ?)",
        [full_name, phoneValue, email.trim(), address?.trim() || null]
      );
      const clientId = clientResult.insertId;
      const [orderResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO orders (client_id, manager_ext_id, agreement_number, target_date, total_cost, current_stage)
         VALUES (?, ?, ?, ?, 0.00, 'Новый')`,
        [clientId, managerId, agreementTrimmed ?? null, target_date ?? null]
      );
      const orderId = orderResult.insertId;
      if (!agreementTrimmed) {
        const autoNumber = formatAutoAgreementNumber(orderId);
        await connection.query("UPDATE orders SET agreement_number = ? WHERE id = ?", [autoNumber, orderId]);
      }
      await StatusManager.appendHistory(connection, orderId, "Новый", actorId);
      await connection.commit();
      res.status(201).json({ status: "success", data: { id: orderId, client_id: clientId } });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async listOrders(req: Request, res: Response): Promise<void> {
    const { status, manager_id, target_date } = req.query;
    const where: string[] = [];
    const values: unknown[] = [];

    if (status) {
      where.push("o.current_stage = ?");
      values.push(status);
    }
    if (target_date) {
      where.push("o.target_date = ?");
      values.push(target_date);
    }
    if (req.user?.role === "Менеджер") {
      where.push("o.manager_ext_id = ?");
      values.push(req.user.id);
    } else if (req.user?.role === "Руководитель" && manager_id) {
      where.push("o.manager_ext_id = ?");
      values.push(manager_id);
    }

    const query = `
      SELECT
        o.*,
        c.full_name,
        c.phone,
        c.email,
        c.address,
        COALESCE(
          (
            SELECT t.operation_name
            FROM tasks t
            WHERE t.order_id = o.id AND t.progress_status = 'В работе'
            ORDER BY t.id ASC
            LIMIT 1
          ),
          (
            SELECT t.operation_name
            FROM tasks t
            WHERE t.order_id = o.id AND t.progress_status = 'Ожидает'
            ORDER BY t.id ASC
            LIMIT 1
          ),
          NULL
        ) AS production_stage,
        (
          SELECT COUNT(*)
          FROM specification_items si
          WHERE si.order_id = o.id
        ) > 0 AS has_specification,
        (
          SELECT COUNT(*)
          FROM tasks t
          WHERE t.order_id = o.id
        ) AS tasks_total_count,
        (
          SELECT COUNT(*)
          FROM tasks t
          WHERE t.order_id = o.id
            AND t.progress_status IN ('В работе', 'Завершен')
        ) AS tasks_started_count,
        (
          SELECT COUNT(*)
          FROM tasks t
          WHERE t.order_id = o.id
            AND t.progress_status = 'Завершен'
        ) AS tasks_completed_count
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY o.target_date ASC, o.created_at DESC
    `;
    const [rows] = await dbPool.query(query, values);
    res.json({ status: "success", data: rows });
  }

  /** Веб-заявки: заказы с системным менеджером, ожидающие распределения. */
  static async listWebApplications(_req: Request, res: Response): Promise<void> {
    /** Явный список полей заказа: без `o.*`, чтобы поля клиента (`email` и др.) не перекрывались одноимёнными колонками заказа в будущем. */
    const query = `
      SELECT
        o.id,
        o.client_id,
        o.manager_ext_id,
        o.agreement_number,
        o.created_at,
        o.updated_at,
        o.target_date,
        o.total_cost,
        o.current_stage,
        c.full_name,
        c.phone,
        c.email,
        c.address,
        NULL AS production_stage,
        (
          SELECT COUNT(*)
          FROM specification_items si
          WHERE si.order_id = o.id
        ) > 0 AS has_specification,
        (
          SELECT COUNT(*)
          FROM tasks t
          WHERE t.order_id = o.id
        ) AS tasks_total_count,
        (
          SELECT COUNT(*)
          FROM tasks t
          WHERE t.order_id = o.id
            AND t.progress_status IN ('В работе', 'Завершен')
        ) AS tasks_started_count,
        (
          SELECT COUNT(*)
          FROM tasks t
          WHERE t.order_id = o.id
            AND t.progress_status = 'Завершен'
        ) AS tasks_completed_count
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      WHERE o.manager_ext_id = 'system_web_lead' AND o.current_stage = 'Новый'
      ORDER BY o.created_at DESC
    `;
    const [rows] = await dbPool.query(query);
    res.json({ status: "success", data: rows });
  }

  /** Закрепить веб-заявку за текущим менеджером и оформить как заказ. */
  static async claimWebApplication(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const parsed = claimWebApplicationSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "Ошибка валидации");

    const actorId = req.user?.id;
    if (!actorId) throw new AppError(401, "Недействительный токен");

    const { agreement_number, target_date, full_name, phone, email, address } = parsed.data;
    const phoneValue = phone ? phone : null;
    const agreementTrimmed = agreement_number?.trim();
    const finalAgreementNumber = agreementTrimmed?.length
      ? agreementTrimmed
      : formatAutoAgreementNumber(id);

    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();
      const [orderRows] = await connection.query(
        `SELECT o.id, o.client_id, c.full_name AS client_full_name, c.phone AS client_phone, c.email AS client_email, c.address AS client_address
         FROM orders o
         JOIN clients c ON c.id = o.client_id
         WHERE o.id = ? AND o.manager_ext_id = 'system_web_lead' AND o.current_stage = 'Новый'
         FOR UPDATE`,
        [id]
      );
      const row = (orderRows as Array<{
        id: number;
        client_id: number;
        client_full_name: string;
        client_phone: string | null;
        client_email: string | null;
        client_address: string | null;
      }>)[0];
      if (!row) {
        throw new AppError(404, "Заявка не найдена или уже обработана");
      }

      const nextFullName = full_name?.trim() || row.client_full_name;
      const nextAddress = address?.trim() ?? row.client_address;

      await connection.query(
        "UPDATE clients SET full_name = ?, phone = ?, email = ?, address = ? WHERE id = ?",
        [nextFullName, phoneValue, email.trim(), nextAddress, row.client_id]
      );

      const [upd] = await connection.query<ResultSetHeader>(
        `UPDATE orders SET
          manager_ext_id = ?,
          agreement_number = ?,
          target_date = ?,
          updated_at = CURRENT_TIMESTAMP(3)
         WHERE id = ? AND manager_ext_id = 'system_web_lead' AND current_stage = 'Новый'`,
        [actorId, finalAgreementNumber, target_date, id]
      );
      if (upd.affectedRows !== 1) {
        throw new AppError(409, "Заявка уже обработана другим менеджером");
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    res.json({ status: "success" });
  }

  /** Отклонить веб-заявку: уведомление на email и удаление записи. */
  static async rejectWebApplication(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const [rows] = await dbPool.query(
      `SELECT o.id, o.agreement_number, o.manager_ext_id, o.current_stage, c.full_name, c.email
       FROM orders o
       JOIN clients c ON c.id = o.client_id
       WHERE o.id = ?`,
      [id]
    );
    const order = (rows as Array<{
      id: number;
      agreement_number: string | null;
      manager_ext_id: string;
      current_stage: string;
      full_name: string;
      email: string | null;
    }>)[0];
    if (!order) throw new AppError(404, "Заявка не найдена");
    if (order.manager_ext_id !== "system_web_lead" || order.current_stage !== "Новый") {
      throw new AppError(409, "Можно отклонить только необработанную веб-заявку");
    }

    await NotificationService.sendWebApplicationRejectedEmail({
      toEmail: order.email,
      clientName: order.full_name,
      agreementNumber: order.agreement_number
    });

    const [mediaRows] = await dbPool.query("SELECT secure_link FROM media_files WHERE order_id = ?", [id]);
    const secureLinks = (mediaRows as Array<{ secure_link: string }>).map((item) => item.secure_link);
    await removeManagedFiles(secureLinks);
    await dbPool.query("DELETE FROM orders WHERE id = ?", [id]);
    res.json({ status: "success" });
  }

  static async updateOrder(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const [rows] = await dbPool.query("SELECT manager_ext_id, client_id FROM orders WHERE id = ?", [id]);
    const order = (rows as Array<{ manager_ext_id: string; client_id: number }>)[0];
    if (!order) throw new AppError(404, "Заказ не найден");
    if (req.user?.role !== "Руководитель" && req.user?.id !== order.manager_ext_id) {
      throw new AppError(403, "Вы не можете изменить чужой заказ");
    }

    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();
      const { agreement_number, target_date, full_name, phone, email, address } = req.body as Record<string, string>;
      await connection.query(
        `UPDATE orders SET
          agreement_number = COALESCE(?, agreement_number),
          target_date = COALESCE(?, target_date),
          updated_at = CURRENT_TIMESTAMP(3)
        WHERE id = ?`,
        [agreement_number ?? null, target_date ?? null, id]
      );
      if (full_name || phone || email || address) {
        await connection.query("UPDATE clients SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone), email = COALESCE(?, email), address = COALESCE(?, address) WHERE id = ?", [
          full_name ?? null,
          phone ?? null,
          email ?? null,
          address ?? null,
          order.client_id
        ]);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    res.json({ status: "success" });
  }

  static async deleteOrder(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const [rows] = await dbPool.query("SELECT manager_ext_id, current_stage FROM orders WHERE id = ?", [id]);
    const order = (rows as Array<{ manager_ext_id: string; current_stage: string }>)[0];
    if (!order) throw new AppError(404, "Заказ не найден");
    if (order.current_stage !== "Новый") {
      throw new AppError(409, "Отменить можно только заказ, ещё не принятый в производство.");
    }
    if (req.user?.role !== "Руководитель" && req.user?.id !== order.manager_ext_id) {
      throw new AppError(403, "Вы не можете изменить чужой заказ");
    }
    const [mediaRows] = await dbPool.query("SELECT secure_link FROM media_files WHERE order_id = ?", [id]);
    const secureLinks = (mediaRows as Array<{ secure_link: string }>).map((item) => item.secure_link);
    await removeManagedFiles(secureLinks);
    await dbPool.query("DELETE FROM orders WHERE id = ?", [id]);
    res.json({ status: "success" });
  }

  static async uploadSpecification(req: Request, res: Response): Promise<void> {
    const orderId = Number(req.params.id);
    const [orderRows] = await dbPool.query("SELECT id, current_stage FROM orders WHERE id = ? LIMIT 1", [orderId]);
    const order = (orderRows as Array<{ id: number; current_stage: string }>)[0];
    if (!order) {
      throw new AppError(404, "Заказ не найден");
    }
    if (order.current_stage !== "Новый") {
      throw new AppError(409, "Спецификацию можно изменять только для заказа в статусе 'Новый'");
    }

    const parsedItems = await parseSpecificationCsv(req.file);
    const { classified, lines, hasMissing, totalCost } = await evaluateSpecificationRows(parsedItems);

    if (hasMissing) {
      const { mode, value } = await readOrderMarkup(orderId);
      const payload = buildSpecificationMutationPayload(false, totalCost, mode, value, lines, true);
      res.json({
        status: "success",
        data: payload
      });
      return;
    }

    const preparedItems = PricingService.classifiedToPreparedItems(classified);

    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();
      const savedMaterialsTotal = await PricingService.saveSpecification(orderId, preparedItems, connection);
      const { mode, value } = await readOrderMarkupFromConnection(connection, orderId);
      const { clientTotal } = computeClientTotalWithMarkup(savedMaterialsTotal, mode, value);
      await connection.query("UPDATE orders SET total_cost = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?", [
        clientTotal,
        orderId
      ]);

      const [reserveCountRows] = await connection.query(
        "SELECT COUNT(*) AS cnt FROM inventory_transactions WHERE order_id = ? AND tx_type = 'Резерв'",
        [orderId]
      );
      const reserveCnt = Number((reserveCountRows as Array<{ cnt: number }>)[0]?.cnt ?? 0);
      if (reserveCnt > 0) {
        await InventoryService.syncReserveForOrder(orderId, connection);
      }

      await connection.commit();

      const payload = buildSpecificationMutationPayload(true, savedMaterialsTotal, mode, value, lines, false);
      res.json({
        status: "success",
        data: payload
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async previewSpecification(req: Request, res: Response): Promise<void> {
    const orderId = Number(req.params.id);
    const [orderRows] = await dbPool.query("SELECT id, current_stage FROM orders WHERE id = ? LIMIT 1", [orderId]);
    const order = (orderRows as Array<{ id: number; current_stage: string }>)[0];
    if (!order) {
      throw new AppError(404, "Заказ не найден");
    }
    if (order.current_stage !== "Новый") {
      throw new AppError(409, "Спецификацию можно изменять только для заказа в статусе 'Новый'");
    }

    const parsedBody = specificationRowsSchema.safeParse(req.body);
    if (!parsedBody.success) {
      throw new AppError(400, "Ошибка валидации");
    }

    const parsedItems: ParsedSpecificationItem[] = parsedBody.data.rows.map((row) => ({
      article: row.article,
      quantity: row.quantity
    }));

    const { lines, hasMissing, totalCost } = await evaluateSpecificationRows(parsedItems);

    const { mode, value } = await readOrderMarkup(orderId);
    const payload = buildSpecificationMutationPayload(false, totalCost, mode, value, lines, hasMissing);

    res.json({
      status: "success",
      data: payload
    });
  }

  static async commitSpecification(req: Request, res: Response): Promise<void> {
    const orderId = Number(req.params.id);
    const [orderRows] = await dbPool.query("SELECT id, current_stage FROM orders WHERE id = ? LIMIT 1", [orderId]);
    const order = (orderRows as Array<{ id: number; current_stage: string }>)[0];
    if (!order) {
      throw new AppError(404, "Заказ не найден");
    }
    if (order.current_stage !== "Новый") {
      throw new AppError(409, "Спецификацию можно изменять только для заказа в статусе 'Новый'");
    }

    const parsedBody = specificationRowsSchema.safeParse(req.body);
    if (!parsedBody.success) {
      throw new AppError(400, "Ошибка валидации");
    }

    const parsedItems: ParsedSpecificationItem[] = parsedBody.data.rows.map((row) => ({
      article: row.article,
      quantity: row.quantity
    }));

    const { classified, lines } = await evaluateSpecificationRows(parsedItems);
    const firstMissing = classified.find((row) => row.status === "missing");
    if (firstMissing) {
      throw new AppError(
        400,
        `Сохранение невозможно: артикул ${firstMissing.article} отсутствует в номенклатуре`
      );
    }

    const preparedItems = PricingService.classifiedToPreparedItems(classified);

    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();
      const savedMaterialsTotal = await PricingService.saveSpecification(orderId, preparedItems, connection);
      const { mode, value } = await readOrderMarkupFromConnection(connection, orderId);
      const { clientTotal } = computeClientTotalWithMarkup(savedMaterialsTotal, mode, value);
      await connection.query("UPDATE orders SET total_cost = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?", [
        clientTotal,
        orderId
      ]);

      const [reserveCountRows] = await connection.query(
        "SELECT COUNT(*) AS cnt FROM inventory_transactions WHERE order_id = ? AND tx_type = 'Резерв'",
        [orderId]
      );
      const reserveCnt = Number((reserveCountRows as Array<{ cnt: number }>)[0]?.cnt ?? 0);
      if (reserveCnt > 0) {
        await InventoryService.syncReserveForOrder(orderId, connection);
      }

      await connection.commit();

      const payload = buildSpecificationMutationPayload(true, savedMaterialsTotal, mode, value, lines, false);
      res.json({
        status: "success",
        data: payload
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getSpecification(req: Request, res: Response): Promise<void> {
    const orderId = Number(req.params.id);
    const [rows] = await dbPool.query(
      `SELECT
          m.article,
          m.name,
          si.required_quantity,
          m.base_cost AS unit_price,
          si.sale_price AS amount
       FROM specification_items si
       JOIN materials m ON m.id = si.material_id
       WHERE si.order_id = ?
       ORDER BY si.id ASC`,
      [orderId]
    );
    const items = (rows as Array<Record<string, string | number>>).map((item, index) => ({
      row_id: `saved-${index}`,
      article: String(item.article),
      name: String(item.name),
      required_quantity: Number(item.required_quantity).toFixed(3),
      unit_price: Number(item.unit_price).toFixed(2),
      amount: Number(item.amount).toFixed(2),
      missing_material: false
    }));
    const [orderRows] = await dbPool.query(
      `SELECT
          o.total_cost,
          o.pricing_markup_mode,
          o.pricing_markup_value,
          (SELECT COALESCE(SUM(si2.sale_price), 0) FROM specification_items si2 WHERE si2.order_id = o.id) AS materials_subtotal
       FROM orders o
       WHERE o.id = ?
       LIMIT 1`,
      [orderId]
    );
    const orderRow = (orderRows as Array<{
      total_cost: string | null;
      pricing_markup_mode: string | null;
      pricing_markup_value: string | number | null;
      materials_subtotal: string | number | null;
    }>)[0];
    if (!orderRow) {
      throw new AppError(404, "Заказ не найден");
    }
    const materialsSubtotal = Number(orderRow.materials_subtotal ?? 0);
    const mode = parsePricingMarkupMode(orderRow?.pricing_markup_mode);
    const value = Number(orderRow?.pricing_markup_value ?? 0);
    const { clientTotal, markupAmount } = computeClientTotalWithMarkup(materialsSubtotal, mode, value);
    res.json({
      status: "success",
      data: {
        total_cost: clientTotal.toFixed(2),
        materials_subtotal: materialsSubtotal.toFixed(2),
        pricing_markup_mode: mode,
        pricing_markup_value: String(value),
        markup_amount: markupAmount.toFixed(2),
        items
      }
    });
  }

  static async patchPricingMarkup(req: Request, res: Response): Promise<void> {
    const orderId = Number(req.params.id);
    const parsed = pricingMarkupPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Ошибка валидации наценки");
    }
    const mode = parsed.data.pricing_markup_mode;
    const value = parsed.data.pricing_markup_value;
    validatePricingMarkupValue(mode, value);

    const actorId = req.user?.id;
    if (!actorId) {
      throw new AppError(401, "Недействительный токен");
    }

    const [orderRows] = await dbPool.query(
      "SELECT id, current_stage, manager_ext_id FROM orders WHERE id = ? LIMIT 1",
      [orderId]
    );
    const order = (orderRows as Array<{ id: number; current_stage: string; manager_ext_id: string }>)[0];
    if (!order) {
      throw new AppError(404, "Заказ не найден");
    }
    if (order.current_stage !== "Новый") {
      throw new AppError(409, "Наценку можно менять только для заказа в статусе «Новый».");
    }
    if (req.user?.role !== "Руководитель" && req.user?.id !== order.manager_ext_id) {
      throw new AppError(403, "Вы не можете изменить чужой заказ");
    }

    const [sumRows] = await dbPool.query(
      "SELECT COALESCE(SUM(sale_price), 0) AS s FROM specification_items WHERE order_id = ?",
      [orderId]
    );
    const materialsSubtotal = Number((sumRows as Array<{ s: string | number }>)[0]?.s ?? 0);
    const { clientTotal, markupAmount } = computeClientTotalWithMarkup(materialsSubtotal, mode, value);

    await dbPool.query(
      `UPDATE orders
       SET pricing_markup_mode = ?, pricing_markup_value = ?, total_cost = ?, updated_at = CURRENT_TIMESTAMP(3)
       WHERE id = ?`,
      [mode, value, clientTotal, orderId]
    );

    res.json({
      status: "success",
      data: {
        materials_subtotal: materialsSubtotal.toFixed(2),
        pricing_markup_mode: mode,
        pricing_markup_value: String(value),
        markup_amount: markupAmount.toFixed(2),
        total_cost: clientTotal.toFixed(2)
      }
    });
  }

  static async patchStatus(req: Request, res: Response): Promise<void> {
    const orderId = Number(req.params.id);
    const status = String(req.body.status ?? "");
    if (!req.user?.id) throw new AppError(401, "Недействительный токен");
    if (
      req.user.role === "Менеджер" &&
      (status === "Распил" || status === "Кромление" || status === "Присадка" || status === "Сборка")
    ) {
      throw new AppError(403, "Менеджер не может вручную устанавливать этапы цеха (Распил, Кромление, Присадка, Сборка)");
    }
    await StatusManager.changeStatus(orderId, status, req.user.id);
    res.json({ status: "success" });
  }

  static async uploadMedia(req: Request, res: Response): Promise<void> {
    if (!req.file) throw new AppError(400, "Файл не найден");
    const orderId = Number(req.params.id);
    const fileType = String(req.body.file_type ?? "Фото");
    const secureLink = `/uploads/${req.file.filename}`;
    await dbPool.query("INSERT INTO media_files (order_id, file_type, secure_link) VALUES (?, ?, ?)", [orderId, fileType, secureLink]);
    res.status(201).json({ status: "success", data: { secure_link: secureLink } });
  }

  static async getMedia(req: Request, res: Response): Promise<void> {
    const orderId = Number(req.params.id);
    const fileType = String(req.query.file_type ?? "").trim();
    const where = fileType ? "WHERE order_id = ? AND file_type = ?" : "WHERE order_id = ?";
    const params = fileType ? [orderId, fileType] : [orderId];
    const [rows] = await dbPool.query(
      `SELECT id, order_id, file_type, secure_link, uploaded_at
       FROM media_files
       ${where}
       ORDER BY uploaded_at DESC`,
      params
    );
    res.json({ status: "success", data: rows });
  }

  static async deleteMedia(req: Request, res: Response): Promise<void> {
    const orderId = Number(req.params.id);
    const mediaId = Number(req.params.mediaId);

    const [rows] = await dbPool.query(
      "SELECT id, order_id, secure_link FROM media_files WHERE id = ? AND order_id = ? LIMIT 1",
      [mediaId, orderId]
    );
    const media = (rows as Array<{ id: number; order_id: number; secure_link: string }>)[0];
    if (!media) {
      throw new AppError(404, "Файл не найден");
    }

    await removeManagedFiles([media.secure_link]);
    await dbPool.query("DELETE FROM media_files WHERE id = ?", [mediaId]);
    res.json({ status: "success" });
  }
}
