import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { AppError } from "../utils/AppError";
import { INV_TX, physicalStockExpression } from "../constants/inventoryTransactions";

interface SpecRow extends RowDataPacket {
  material_id: number;
  required_quantity: string;
}

interface TxRow extends RowDataPacket {
  id: number;
  material_id: number;
  quantity_change: string;
}

export class InventoryService {
  /**
   * Агрегирует потребность по спецификации и синхронизирует строки резерва:
   * одна запись на пару (order_id, material_id), без дублей при повторном переводе в производство.
   * Фактический остаток на складе не меняет.
   */
  static async syncReserveForOrder(orderId: number, connection: PoolConnection): Promise<void> {
    const [specRows] = await connection.query<SpecRow[]>(
      "SELECT material_id, required_quantity FROM specification_items WHERE order_id = ?",
      [orderId]
    );

    const desired = new Map<number, number>();
    for (const row of specRows) {
      const mid = Number(row.material_id);
      const q = Number(row.required_quantity);
      if (!Number.isFinite(mid) || !Number.isFinite(q)) continue;
      desired.set(mid, (desired.get(mid) ?? 0) + q);
    }

    if (desired.size === 0) {
      await connection.query(
        "DELETE FROM inventory_transactions WHERE order_id = ? AND tx_type = ?",
        [orderId, INV_TX.RESERVE]
      );
      return;
    }

    const materialIds = [...desired.keys()];
    const placeholders = materialIds.map(() => "?").join(",");

    await connection.query(
      `DELETE FROM inventory_transactions
       WHERE order_id = ? AND tx_type = ? AND material_id NOT IN (${placeholders})`,
      [orderId, INV_TX.RESERVE, ...materialIds]
    );

    for (const [materialId, qty] of desired) {
      const quantityChange = -Math.abs(qty);

      const [existingReserve] = await connection.query<TxRow[]>(
        `SELECT id FROM inventory_transactions
         WHERE order_id = ? AND material_id = ? AND tx_type = ?
         LIMIT 1`,
        [orderId, materialId, INV_TX.RESERVE]
      );

      const reserveRow = existingReserve[0];
      if (reserveRow) {
        await connection.query(
          "UPDATE inventory_transactions SET quantity_change = ? WHERE id = ?",
          [quantityChange, reserveRow.id]
        );
        continue;
      }

      const [existingConsumption] = await connection.query<TxRow[]>(
        `SELECT id FROM inventory_transactions
         WHERE order_id = ? AND material_id = ? AND tx_type = ?
         LIMIT 1`,
        [orderId, materialId, INV_TX.CONSUMPTION]
      );

      if (existingConsumption[0]) {
        continue;
      }

      await connection.query(
        `INSERT INTO inventory_transactions (material_id, order_id, tx_type, quantity_change)
         VALUES (?, ?, ?, ?)`,
        [materialId, orderId, INV_TX.RESERVE, quantityChange]
      );
    }
  }

  /**
   * Откат в «Новый» до начала заданий: удаляем только созданные задания цеха.
   * Строки «Резерв» в inventory_transactions не меняем и не удаляем — до старта работ они те же,
   * что были после первого перевода в производство.
   */
  static async removeProductionTasksForOrder(orderId: number, connection: PoolConnection): Promise<void> {
    await connection.query("DELETE FROM tasks WHERE order_id = ?", [orderId]);
  }

  /**
   * Первый переход задания в «В работе»: резерв по заказу превращается в списание.
   * Списание учитывается в фактическом остатке через сумму движений после `stock_snapshot_at`;
   * время операции обновляется, чтобы отнести списание к моменту фактического расхода.
   */
  static async convertReserveToConsumptionForOrder(orderId: number, connection: PoolConnection): Promise<void> {
    const [reserveRows] = await connection.query<TxRow[]>(
      `SELECT id, material_id, quantity_change FROM inventory_transactions
       WHERE order_id = ? AND tx_type = ?`,
      [orderId, INV_TX.RESERVE]
    );

    for (const row of reserveRows) {
      await connection.query(
        "UPDATE inventory_transactions SET tx_type = ?, tx_date = CURRENT_TIMESTAMP(3) WHERE id = ?",
        [INV_TX.CONSUMPTION, row.id]
      );
    }
  }

  /**
   * Перед переводом задания в «В работе» резерв по заказу превращается в списание.
   * Если по какому-либо материалу фактический остаток после этого стал бы отрицательным — блокируем старт.
   */
  static async assertReserveConversionWontCauseNegativePhysicalStock(
    orderId: number,
    connection: PoolConnection
  ): Promise<void> {
    const physical = physicalStockExpression("m");
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT
          m.id AS material_id,
          (${physical}) AS physical_now,
          COALESCE(SUM(r.quantity_change), 0) AS reserve_qty_sum
       FROM materials m
       INNER JOIN inventory_transactions r
         ON r.material_id = m.id AND r.order_id = ? AND r.tx_type = ?
       GROUP BY m.id, m.stock_snapshot, m.stock_snapshot_at`,
      [orderId, INV_TX.RESERVE]
    );

    for (const row of rows) {
      const physicalNow = Number(row.physical_now);
      const reserveSum = Number(row.reserve_qty_sum);
      if (!Number.isFinite(physicalNow) || !Number.isFinite(reserveSum)) {
        continue;
      }
      const projected = physicalNow + reserveSum;
      if (projected < 0) {
        throw new AppError(
          409,
          "Недостаточно материала на складе, чтобы начать работу. Оформите приход или согласуйте изменения по заказу."
        );
      }
    }
  }
}
