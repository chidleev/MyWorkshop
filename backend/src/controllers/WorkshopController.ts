import type { Request, Response } from "express";
import { dbPool } from "../config/db";

export class WorkshopController {
  static async getTasks(req: Request, res: Response): Promise<void> {
    const status = req.query.status;
    const [rows] = await dbPool.query(
      `SELECT t.id, t.operation_name, t.progress_status, t.master_ext_id, o.id as order_id, o.agreement_number, o.target_date, c.full_name
       FROM tasks t
       JOIN orders o ON o.id = t.order_id
       JOIN clients c ON c.id = o.client_id
       ${status ? "WHERE t.progress_status = ?" : ""}
       ORDER BY (t.progress_status = 'Ожидает') DESC, o.target_date ASC`,
      status ? [status] : []
    );
    res.json({ status: "success", data: rows });
  }

  static async getDeployments(_req: Request, res: Response): Promise<void> {
    const [rows] = await dbPool.query(
      `SELECT
          o.id AS order_id,
          o.agreement_number,
          o.current_stage,
          o.target_date,
          c.full_name,
          c.phone,
          c.address,
          m.secure_link
       FROM orders o
       JOIN clients c ON c.id = o.client_id
       LEFT JOIN media_files m ON m.order_id = o.id
       WHERE o.current_stage IN ('Готов к отгрузке', 'Сборка')
       ORDER BY o.target_date ASC`
    );
    res.json({ status: "success", data: rows });
  }
}
