import type { Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { dbPool } from "../config/db";
import { AppError } from "../utils/AppError";
import { parseSpecificationCsv } from "../services/SpecificationParser";
import { PricingService } from "../services/PricingService";
import { StatusManager } from "../services/StatusManager";

const createOrderSchema = z.object({
  client_id: z.number().int().positive(),
  agreement_number: z.string().min(1).optional(),
  target_date: z.string().optional()
});

export const specificationUpload = multer({ storage: multer.memoryStorage() });
export const mediaUpload = multer({
  storage: multer.diskStorage({
    destination: "uploads/",
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

    const managerId = req.user?.id;
    if (!managerId) throw new AppError(401, "Недействительный токен");

    const { client_id, agreement_number, target_date } = parsed.data;
    const [result] = await dbPool.query(
      `INSERT INTO orders (client_id, manager_ext_id, agreement_number, target_date, total_cost, current_stage)
       VALUES (?, ?, ?, ?, 0.00, 'Новый')`,
      [client_id, managerId, agreement_number ?? null, target_date ?? null]
    );
    res.status(201).json({ status: "success", data: { id: (result as any).insertId } });
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
      SELECT o.*, c.full_name, c.phone
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY o.target_date ASC, o.created_at DESC
    `;
    const [rows] = await dbPool.query(query, values);
    res.json({ status: "success", data: rows });
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
      const { agreement_number, target_date, full_name, phone } = req.body as Record<string, string>;
      await connection.query("UPDATE orders SET agreement_number = COALESCE(?, agreement_number), target_date = COALESCE(?, target_date) WHERE id = ?", [
        agreement_number ?? null,
        target_date ?? null,
        id
      ]);
      if (full_name || phone) {
        await connection.query("UPDATE clients SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone) WHERE id = ?", [
          full_name ?? null,
          phone ?? null,
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
    const [rows] = await dbPool.query("SELECT manager_ext_id FROM orders WHERE id = ?", [id]);
    const order = (rows as Array<{ manager_ext_id: string }>)[0];
    if (!order) throw new AppError(404, "Заказ не найден");
    if (req.user?.role !== "Руководитель" && req.user?.id !== order.manager_ext_id) {
      throw new AppError(403, "Вы не можете изменить чужой заказ");
    }
    await dbPool.query("DELETE FROM orders WHERE id = ?", [id]);
    res.json({ status: "success" });
  }

  static async uploadSpecification(req: Request, res: Response): Promise<void> {
    const orderId = Number(req.params.id);
    const parsedItems = await parseSpecificationCsv(req.file);
    const preparedItems = await PricingService.enrichWithMaterialPrices(parsedItems);

    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();
      const totalCost = await PricingService.saveSpecification(orderId, preparedItems, connection);
      await connection.query("UPDATE orders SET total_cost = ? WHERE id = ?", [totalCost, orderId]);
      await connection.commit();

      res.json({
        status: "success",
        data: {
          total_cost: totalCost,
          items: preparedItems
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async patchStatus(req: Request, res: Response): Promise<void> {
    const orderId = Number(req.params.id);
    const status = String(req.body.status ?? "");
    if (!req.user?.id) throw new AppError(401, "Недействительный токен");
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
}
