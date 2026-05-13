import type { PoolConnection } from "mysql2/promise";
import { dbPool } from "../config/db";
import { AppError } from "../utils/AppError";
import { InventoryService } from "./InventoryService";
import { NotificationService } from "./NotificationService";

const VALID_STATUSES = new Set([
  "Новый",
  "В производстве",
  "Распил",
  "Кромление",
  "Присадка",
  "Сборка",
  "Готов к отгрузке",
  "Завершен"
]);

const WORKSHOP_PIPELINE_STAGES = new Set([
  "В производстве",
  "Распил",
  "Кромление",
  "Присадка",
  "Сборка"
]);

const TASK_PROGRESS_HISTORY_LABEL: Record<string, string> = {
  Ожидает: "Ожидание",
  "В работе": "В работе",
  Завершен: "Завершено"
};

export class StatusManager {
  /** Подпись для журнала: «Распил (Ожидание)», «Кромление (В работе)» и т.п. */
  static syntheticTaskHistoryLabel(operationName: string, progressStatus: string): string {
    const tail = TASK_PROGRESS_HISTORY_LABEL[progressStatus] ?? progressStatus;
    return `${operationName} (${tail})`;
  }

  /** Единая точка записи перехода этапа заказа в журнал `status_histories`. */
  static async appendHistory(
    connection: PoolConnection,
    orderId: number,
    stageName: string,
    employeeExtId: string
  ): Promise<void> {
    await connection.query(
      "INSERT INTO status_histories (order_id, stage_name, employee_ext_id) VALUES (?, ?, ?)",
      [orderId, stageName, employeeExtId]
    );
  }

  static validateStatus(status: string): void {
    if (!VALID_STATUSES.has(status)) {
      throw new AppError(400, "Недопустимый статус");
    }
  }

  static async changeStatus(orderId: number, newStatus: string, userId: string): Promise<void> {
    this.validateStatus(newStatus);
    const connection = await dbPool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query(
        `SELECT
          o.current_stage,
          (
            SELECT COUNT(*)
            FROM specification_items si
            WHERE si.order_id = o.id
          ) AS specification_count,
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
         WHERE o.id = ?
         LIMIT 1`,
        [orderId]
      );
      const current = (rows as Array<{
        current_stage: string;
        specification_count: number;
        tasks_total_count: number;
        tasks_started_count: number;
        tasks_completed_count: number;
      }>)[0];
      if (!current) {
        throw new AppError(404, "Заказ не найден");
      }
      if (current.current_stage === newStatus) {
        await connection.rollback();
        return;
      }

      if (current.current_stage === "Завершен") {
        throw new AppError(409, "Нельзя изменить статус завершенного заказа");
      }

      if (newStatus === "Завершен" && current.current_stage !== "Готов к отгрузке") {
        throw new AppError(409, "Заказ можно перевести в «Завершен» только из статуса «Готов к отгрузке»");
      }

      const hasSpecification = Number(current.specification_count) > 0;
      const tasksTotal = Number(current.tasks_total_count);
      const tasksStarted = Number(current.tasks_started_count);
      const tasksCompleted = Number(current.tasks_completed_count);
      const allTasksCompleted = tasksTotal > 0 && tasksCompleted === tasksTotal;

      if (!hasSpecification && (newStatus === "В производстве" || newStatus === "Готов к отгрузке")) {
        throw new AppError(409, "Нельзя перевести заказ без спецификации в этот статус");
      }

      if (newStatus === "Готов к отгрузке" && !allTasksCompleted) {
        throw new AppError(409, "Нельзя перевести заказ в 'Готов к отгрузке', пока не завершены все задания");
      }

      if (newStatus === "Новый" && tasksStarted > 0 && WORKSHOP_PIPELINE_STAGES.has(current.current_stage)) {
        throw new AppError(409, "Нельзя вернуть заказ в статус 'Новый', если задания уже начаты");
      }

      if (
        current.current_stage === "Готов к отгрузке" &&
        (newStatus === "Новый" ||
          newStatus === "В производстве" ||
          newStatus === "Распил" ||
          newStatus === "Кромление" ||
          newStatus === "Присадка" ||
          newStatus === "Сборка") &&
        allTasksCompleted
      ) {
        throw new AppError(409, "Нельзя вернуть выполненный заказ в предыдущий статус");
      }

      if (newStatus === "Новый" && tasksStarted === 0) {
        await InventoryService.removeProductionTasksForOrder(orderId, connection);
      }

      await connection.query("UPDATE orders SET current_stage = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?", [
        newStatus,
        orderId
      ]);
      await StatusManager.appendHistory(connection, orderId, newStatus, userId);

      if (newStatus === "В производстве") {
        const [taskRows] = await connection.query("SELECT COUNT(*) as total FROM tasks WHERE order_id = ?", [orderId]);
        const total = Number((taskRows as Array<{ total: number }>)[0].total);
        if (total === 0) {
          const ops = ["Распил", "Кромление", "Присадка", "Сборка"];
          const values = ops.map((op) => [orderId, op, "Ожидает", null]);
          await connection.query("INSERT INTO tasks (order_id, operation_name, progress_status, master_ext_id) VALUES ?", [values]);
        }
        await InventoryService.syncReserveForOrder(orderId, connection);
        const [firstTaskRows] = await connection.query(
          `SELECT operation_name, progress_status
           FROM tasks
           WHERE order_id = ?
           ORDER BY
             CASE operation_name
               WHEN 'Распил' THEN 1
               WHEN 'Кромление' THEN 2
               WHEN 'Присадка' THEN 3
               WHEN 'Сборка' THEN 4
               ELSE 99
             END ASC,
             id ASC
           LIMIT 1`,
          [orderId]
        );
        const firstTask = (firstTaskRows as Array<{ operation_name: string; progress_status: string }>)[0];
        if (firstTask) {
          await StatusManager.appendHistory(
            connection,
            orderId,
            StatusManager.syntheticTaskHistoryLabel(firstTask.operation_name, firstTask.progress_status),
            userId
          );
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    if (newStatus === "Завершен") {
      try {
        const links = await NotificationService.generateDocuments(orderId);
        await NotificationService.sendCompletionEmail(orderId, links);
      } catch (error) {
        console.error("Notification pipeline error:", error);
      }
    }
  }
}
