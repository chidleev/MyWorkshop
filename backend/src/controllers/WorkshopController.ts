import type { Request, Response } from "express";
import { dbPool } from "../config/db";
import { AppError } from "../utils/AppError";
import { InventoryService } from "../services/InventoryService";
import { StatusManager } from "../services/StatusManager";

const MASTER_OPERATION_BY_ID: Record<string, string> = {
  "master-cutting-001": "Распил",
  "master-edging-001": "Кромление",
  "master-drilling-001": "Присадка",
  "master-assembly-001": "Сборка",
};

const OPERATION_ORDER_CASE = `
  CASE operation_name
    WHEN 'Распил' THEN 1
    WHEN 'Кромление' THEN 2
    WHEN 'Присадка' THEN 3
    WHEN 'Сборка' THEN 4
    ELSE 99
  END
`;

/** Этап заказа `current_stage` по активному или следующему заданию цеха (имя операции = этап). */
const ORDER_STAGE_BY_OPERATION: Record<string, string> = {
  Распил: "Распил",
  Кромление: "Кромление",
  Присадка: "Присадка",
  Сборка: "Сборка",
};

function orderStageForOperation(operationName: string): string {
  return ORDER_STAGE_BY_OPERATION[operationName] ?? "В производстве";
}

export class WorkshopController {
  static async getTasks(req: Request, res: Response): Promise<void> {
    const status = req.query.status;
    const where: string[] = [];
    const values: unknown[] = [];

    if (status) {
      where.push("t.progress_status = ?");
      values.push(status);
    }

    if (req.user?.role === "Мастер цеха") {
      const allowedOperation = MASTER_OPERATION_BY_ID[req.user.id];
      if (!allowedOperation) {
        res.json({ status: "success", data: [] });
        return;
      }
      where.push("t.operation_name = ?");
      values.push(allowedOperation);
    }

    where.push(`NOT EXISTS (
      SELECT 1
      FROM tasks prev
      WHERE prev.order_id = t.order_id
        AND (${OPERATION_ORDER_CASE.replace(/operation_name/g, "prev.operation_name")})
          < (${OPERATION_ORDER_CASE.replace(/operation_name/g, "t.operation_name")})
        AND prev.progress_status <> 'Завершен'
    )`);

    const [rows] = await dbPool.query(
      `SELECT t.id, t.operation_name, t.progress_status, t.master_ext_id, o.id as order_id, o.agreement_number, o.target_date, c.full_name
       FROM tasks t
       JOIN orders o ON o.id = t.order_id
       JOIN clients c ON c.id = o.client_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY (t.progress_status = 'Ожидает') DESC, o.target_date ASC`,
      values
    );
    res.json({ status: "success", data: rows });
  }

  static async patchTaskStatus(req: Request, res: Response): Promise<void> {
    const taskId = Number(req.params.id);
    const nextStatus = String(req.body.status ?? "").trim();
    if (!req.user?.id) {
      throw new AppError(401, "Недействительный токен");
    }
    if (!["Ожидает", "В работе", "Завершен"].includes(nextStatus)) {
      throw new AppError(400, "Недопустимый статус задания");
    }

    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();
      const [taskRows] = await connection.query(
        "SELECT id, order_id, operation_name, progress_status, master_ext_id FROM tasks WHERE id = ? LIMIT 1",
        [taskId]
      );
      const task = (
        taskRows as Array<{
          id: number;
          order_id: number;
          operation_name: string;
          progress_status: string;
          master_ext_id: string | null;
        }>
      )[0];
      if (!task) {
        throw new AppError(404, "Задание не найдено");
      }

      if (req.user.role === "Мастер цеха") {
        const allowedOperation = MASTER_OPERATION_BY_ID[req.user.id];
        if (!allowedOperation || task.operation_name !== allowedOperation) {
          throw new AppError(403, "Вы не можете взять это задание");
        }
      }

      const transitions: Record<string, string[]> = {
        Ожидает: ["В работе"],
        "В работе": ["Завершен"],
        Завершен: [],
      };
      if (!transitions[task.progress_status]?.includes(nextStatus)) {
        throw new AppError(400, "Недопустимый переход статуса задания");
      }

      const [blockingRows] = await connection.query(
        `SELECT COUNT(*) as total
         FROM tasks prev
         WHERE prev.order_id = ?
           AND (${OPERATION_ORDER_CASE.replace(/operation_name/g, "prev.operation_name")})
             < (${OPERATION_ORDER_CASE.replace(/operation_name/g, "?")})
           AND prev.progress_status <> 'Завершен'`,
        [task.order_id, task.operation_name]
      );
      const blockingTotal = Number((blockingRows as Array<{ total: number }>)[0]?.total ?? 0);
      if (blockingTotal > 0) {
        throw new AppError(409, "Предыдущий этап этого заказа еще не завершен");
      }

      if (task.master_ext_id && task.master_ext_id !== req.user.id && req.user.role === "Мастер цеха") {
        throw new AppError(403, "Задание уже закреплено за другим мастером");
      }

      if (nextStatus === "В работе") {
        await InventoryService.assertReserveConversionWontCauseNegativePhysicalStock(task.order_id, connection);
      }

      await connection.query(
        `UPDATE tasks
         SET progress_status = ?, master_ext_id = COALESCE(master_ext_id, ?)
         WHERE id = ?`,
        [nextStatus, req.user.id, taskId]
      );

      if (nextStatus === "В работе") {
        await InventoryService.convertReserveToConsumptionForOrder(task.order_id, connection);
      }

      const [inProgressRows] = await connection.query(
        `SELECT operation_name
         FROM tasks
         WHERE order_id = ? AND progress_status = 'В работе'
         ORDER BY ${OPERATION_ORDER_CASE} ASC
         LIMIT 1`,
        [task.order_id]
      );
      const activeInProgress = (inProgressRows as Array<{ operation_name: string }>)[0];

      const [firstOpenRows] = await connection.query(
        `SELECT operation_name, progress_status
         FROM tasks
         WHERE order_id = ? AND progress_status <> 'Завершен'
         ORDER BY ${OPERATION_ORDER_CASE} ASC
         LIMIT 1`,
        [task.order_id]
      );
      const firstOpenTask = (firstOpenRows as Array<{ operation_name: string; progress_status: string }>)[0];

      const [remainingRows] = await connection.query(
        "SELECT COUNT(*) as total FROM tasks WHERE order_id = ? AND progress_status <> 'Завершен'",
        [task.order_id]
      );
      const remainingTotal = Number((remainingRows as Array<{ total: number }>)[0]?.total ?? 0);

      const nextStage =
        remainingTotal === 0
          ? "Готов к отгрузке"
          : activeInProgress
            ? orderStageForOperation(activeInProgress.operation_name)
            : firstOpenTask
              ? orderStageForOperation(firstOpenTask.operation_name)
              : "В производстве";

      const [currentRows] = await connection.query("SELECT current_stage FROM orders WHERE id = ? LIMIT 1", [
        task.order_id,
      ]);
      const editedHistoryLabel = StatusManager.syntheticTaskHistoryLabel(task.operation_name, nextStatus);
      await StatusManager.appendHistory(connection, task.order_id, editedHistoryLabel, req.user.id);

      const currentOrder = (currentRows as Array<{ current_stage: string }>)[0];
      if (currentOrder && currentOrder.current_stage !== nextStage) {
        await connection.query("UPDATE orders SET current_stage = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?", [
          nextStage,
          task.order_id
        ]);
        if (nextStage === "Готов к отгрузке") {
          await StatusManager.appendHistory(connection, task.order_id, nextStage, req.user.id);
        } else {
          const headLabel = firstOpenTask
            ? StatusManager.syntheticTaskHistoryLabel(firstOpenTask.operation_name, firstOpenTask.progress_status)
            : nextStage;
          if (headLabel !== editedHistoryLabel) {
            await StatusManager.appendHistory(connection, task.order_id, headLabel, req.user.id);
          }
        }
      }

      await connection.commit();
      res.json({ status: "success" });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
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
