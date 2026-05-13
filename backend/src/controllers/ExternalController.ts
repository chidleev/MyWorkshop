import type { Request, Response } from "express";
import type { ResultSetHeader } from "mysql2";
import { z } from "zod";
import { dbPool } from "../config/db";
import { AppError } from "../utils/AppError";
import { StatusManager } from "../services/StatusManager";

const createLeadSchema = z.preprocess((raw: unknown) => {
  if (!raw || typeof raw !== "object") {
    return raw;
  }
  const o = { ...(raw as Record<string, unknown>) };
  const fromClientEmail = typeof o.client_email === "string" ? o.client_email.trim() : "";
  const fromEmail = typeof o.email === "string" ? o.email.trim() : "";
  if (!fromClientEmail && fromEmail) {
    o.client_email = fromEmail;
  }
  return o;
}, z.object({
  client_name: z.string().trim().min(1),
  client_email: z.string().trim().email(),
  client_phone: z.string().trim().optional(),
  comment: z.string().trim().optional()
}));

export class ExternalController {
  static async createLead(req: Request, res: Response): Promise<void> {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "Ошибка валидации");
    }

    const { client_name, client_email, client_phone, comment } = parsed.data;
    const leadComment = comment?.trim();
    const phoneValue = client_phone?.trim() ? client_phone.trim() : null;

    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();
      const [clientResult] = await connection.query<ResultSetHeader>(
        "INSERT INTO clients (full_name, phone, email, address) VALUES (?, ?, ?, ?)",
        [client_name.trim(), phoneValue, client_email.trim(), leadComment ? `Комментарий заявки: ${leadComment}` : null]
      );
      const clientId = clientResult.insertId;
      const agreement = `WEB-${Date.now()}`;
      const [orderResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO orders (client_id, manager_ext_id, agreement_number, total_cost, current_stage)
         VALUES (?, 'system_web_lead', ?, 0.00, 'Новый')`,
        [clientId, agreement]
      );
      const orderId = orderResult.insertId;
      await StatusManager.appendHistory(connection, orderId, "Новый", "system_web_lead");
      await connection.commit();
      res.status(201).json({
        status: "success",
        data: { client_id: clientId, order_id: orderId, agreement_number: agreement }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
