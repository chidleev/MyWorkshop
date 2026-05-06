import { dbPool } from "../config/db";
import { AppError } from "../utils/AppError";
import { InventoryService } from "./InventoryService";
import { NotificationService } from "./NotificationService";

const VALID_STATUSES = new Set([
  "В обработке",
  "В производстве",
  "Распил",
  "Сборка",
  "Готов к отгрузке",
  "Завершен"
]);

export class StatusManager {
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
      const [rows] = await connection.query("SELECT current_stage FROM orders WHERE id = ?", [orderId]);
      const current = (rows as Array<{ current_stage: string }>)[0];
      if (!current) {
        throw new AppError(404, "Заказ не найден");
      }
      if (current.current_stage === newStatus) {
        await connection.rollback();
        return;
      }

      await connection.query("UPDATE orders SET current_stage = ? WHERE id = ?", [newStatus, orderId]);
      await connection.query(
        "INSERT INTO status_histories (order_id, stage_name, employee_ext_id) VALUES (?, ?, ?)",
        [orderId, newStatus, userId]
      );

      if (newStatus === "В производстве") {
        const [taskRows] = await connection.query("SELECT COUNT(*) as total FROM tasks WHERE order_id = ?", [orderId]);
        const total = Number((taskRows as Array<{ total: number }>)[0].total);
        if (total === 0) {
          const ops = ["Распил", "Кромление", "Присадка", "Сборка"];
          const values = ops.map((op) => [orderId, op, "Ожидает", null]);
          await connection.query("INSERT INTO tasks (order_id, operation_name, progress_status, master_ext_id) VALUES ?", [values]);
        }
        await InventoryService.consumeMaterialsForOrder(orderId, connection);
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
