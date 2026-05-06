import type { Request, Response } from "express";
import { dbPool } from "../config/db";
import { AppError } from "../utils/AppError";

export class ExternalController {
  static async createLead(req: Request, res: Response): Promise<void> {
    const { client_name, client_phone } = req.body as Record<string, string>;
    if (!client_name || !client_phone) {
      throw new AppError(400, "Ошибка валидации");
    }

    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();
      const [clientResult] = await connection.query("INSERT INTO clients (full_name, phone) VALUES (?, ?)", [
        client_name,
        client_phone
      ]);
      const clientId = (clientResult as any).insertId;
      const agreement = `WEB-${Date.now()}`;
      const [orderResult] = await connection.query(
        `INSERT INTO orders (client_id, manager_ext_id, agreement_number, total_cost, current_stage)
         VALUES (?, 'system_web_lead', ?, 0.00, 'Новый')`,
        [clientId, agreement]
      );
      await connection.commit();
      res.status(201).json({ status: "success", data: { client_id: clientId, order_id: (orderResult as any).insertId } });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
