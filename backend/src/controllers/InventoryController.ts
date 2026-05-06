import type { Request, Response } from "express";
import { dbPool } from "../config/db";
import { AppError } from "../utils/AppError";

export class InventoryController {
  static async getInventory(req: Request, res: Response): Promise<void> {
    const search = String(req.query.search ?? "").trim();
    const hasSearch = search.length > 0;
    const [rows] = await dbPool.query(
      `SELECT id, article, name, base_cost, current_stock
       FROM materials
       ${hasSearch ? "WHERE article LIKE ? OR name LIKE ?" : ""}
       ORDER BY name ASC`,
      hasSearch ? [`%${search}%`, `%${search}%`] : []
    );
    res.json({ status: "success", data: rows });
  }

  static async incomingStock(req: Request, res: Response): Promise<void> {
    const materialId = Number(req.body.material_id);
    const quantity = Number(req.body.quantity);
    if (!Number.isFinite(materialId) || materialId <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
      throw new AppError(400, "Некорректные данные прихода");
    }

    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query("UPDATE materials SET current_stock = current_stock + ? WHERE id = ?", [quantity, materialId]);
      await connection.query(
        "INSERT INTO inventory_transactions (material_id, order_id, tx_type, quantity_change) VALUES (?, NULL, 'Приход', ?)",
        [materialId, quantity]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    res.json({ status: "success" });
  }

  static async getDeficit(req: Request, res: Response): Promise<void> {
    const [rows] = await dbPool.query(
      `SELECT id, article, name, base_cost, current_stock, ABS(current_stock) * base_cost AS total_deficit_cost
       FROM materials
       WHERE current_stock < 0
       ORDER BY current_stock ASC`
    );
    const total_budget = (rows as Array<{ total_deficit_cost: string | number }>).reduce(
      (sum, row) => sum + Number(row.total_deficit_cost),
      0
    );
    res.json({ status: "success", data: rows, total_budget });
  }

  static async getTransactions(req: Request, res: Response): Promise<void> {
    const txType = req.query.tx_type;
    const orderId = req.query.order_id;
    const limit = Number(req.query.limit ?? 200);
    const offset = Number(req.query.offset ?? 0);
    const where: string[] = [];
    const values: unknown[] = [];
    if (txType) {
      where.push("t.tx_type = ?");
      values.push(txType);
    }
    if (orderId) {
      where.push("t.order_id = ?");
      values.push(orderId);
    }

    const query = `
      SELECT t.id, t.tx_date, t.tx_type, t.quantity_change, t.order_id, m.article, m.name
      FROM inventory_transactions t
      JOIN materials m ON t.material_id = m.id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY t.tx_date DESC
      LIMIT ? OFFSET ?
    `;
    values.push(limit, offset);
    const [rows] = await dbPool.query(query, values);
    res.json({ status: "success", data: rows });
  }
}
