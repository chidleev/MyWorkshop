import type { Request, Response } from "express";
import { dbPool } from "../config/db";
import { NotificationService } from "../services/NotificationService";
import { AppError } from "../utils/AppError";

export class DirectorController {
  static async getOrders(req: Request, res: Response): Promise<void> {
    const where: string[] = [];
    const values: unknown[] = [];
    if (req.query.manager_id) {
      where.push("o.manager_ext_id = ?");
      values.push(req.query.manager_id);
    }
    if (req.query.is_overdue === "true") {
      where.push("o.target_date < CURDATE() AND o.current_stage != 'Завершен'");
    }
    if (req.query.status) {
      where.push("o.current_stage = ?");
      values.push(req.query.status);
    }

    const [rows] = await dbPool.query(
      `SELECT o.*, c.full_name, c.phone
       FROM orders o JOIN clients c ON c.id = o.client_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY o.target_date ASC`,
      values
    );
    res.json({ status: "success", data: rows });
  }

  static async getProfitability(_req: Request, res: Response): Promise<void> {
    const [rows] = await dbPool.query(
      `SELECT
          o.id AS order_id,
          o.agreement_number,
          c.full_name AS client_name,
          o.total_cost AS revenue,
          COALESCE(SUM(si.required_quantity * m.base_cost), 0) AS cogs,
          (o.total_cost - COALESCE(SUM(si.required_quantity * m.base_cost), 0)) AS profit
       FROM orders o
       JOIN clients c ON c.id = o.client_id
       LEFT JOIN specification_items si ON si.order_id = o.id
       LEFT JOIN materials m ON m.id = si.material_id
       WHERE o.current_stage = 'Завершен'
       GROUP BY o.id, o.agreement_number, c.full_name, o.total_cost
       ORDER BY o.id DESC`
    );
    const data = (rows as Array<Record<string, string | number>>).map((row) => {
      const revenue = Number(row.revenue);
      const cogs = Number(row.cogs);
      const profit = Number(row.profit);
      return {
        ...row,
        revenue,
        cogs,
        profit,
        margin_percent: revenue === 0 ? 0 : Number(((profit / revenue) * 100).toFixed(2))
      };
    });
    res.json({ status: "success", data });
  }

  static async getWorkload(_req: Request, res: Response): Promise<void> {
    const [rows] = await dbPool.query(
      `SELECT operation_name, progress_status, COUNT(*) as task_count
       FROM tasks
       GROUP BY operation_name, progress_status`
    );
    const grouped: Record<string, Record<string, number>> = {};
    (rows as Array<{ operation_name: string; progress_status: string; task_count: number }>).forEach((row) => {
      if (!grouped[row.operation_name]) {
        grouped[row.operation_name] = {};
      }
      grouped[row.operation_name][row.progress_status] = Number(row.task_count);
    });
    res.json({ status: "success", data: grouped });
  }

  static async getOrderDetails(req: Request, res: Response): Promise<void> {
    const orderId = Number(req.params.id);
    const [orderRows] = await dbPool.query(
      `SELECT
          o.*,
          c.full_name,
          c.phone,
          c.email,
          c.address
       FROM orders o
       JOIN clients c ON c.id = o.client_id
       WHERE o.id = ?
       LIMIT 1`,
      [orderId]
    );
    const order = (orderRows as Array<Record<string, unknown>>)[0];
    if (!order) {
      res.status(404).json({ status: "error", message: "Заказ не найден" });
      return;
    }

    const [specificationRows] = await dbPool.query(
      `SELECT
          si.material_id,
          m.article,
          m.name,
          si.required_quantity,
          si.sale_price
       FROM specification_items si
       JOIN materials m ON m.id = si.material_id
       WHERE si.order_id = ?
       ORDER BY m.name ASC`,
      [orderId]
    );

    const [mediaRows] = await dbPool.query(
      `SELECT id, file_type, secure_link, uploaded_at
       FROM media_files
       WHERE order_id = ?
       ORDER BY uploaded_at DESC`,
      [orderId]
    );

    const [historyRows] = await dbPool.query(
      `SELECT id, stage_name, transition_date, employee_ext_id
       FROM status_histories
       WHERE order_id = ?
       ORDER BY transition_date ASC, id ASC`,
      [orderId]
    );

    res.json({
      status: "success",
      data: {
        order,
        specification: specificationRows,
        media: mediaRows,
        status_histories: historyRows
      }
    });
  }

  /** Пересоздание PDF чека и акта по текущим данным заказа (без повторной отправки email). */
  static async regenerateOrderDocuments(req: Request, res: Response): Promise<void> {
    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      throw new AppError(400, "Некорректный идентификатор заказа");
    }
    const links = await NotificationService.generateDocuments(orderId);
    res.json({ status: "success", data: links });
  }
}
