import type { PoolConnection, RowDataPacket } from "mysql2/promise";

interface SpecRow extends RowDataPacket {
  material_id: number;
  required_quantity: string;
}

export class InventoryService {
  static async consumeMaterialsForOrder(orderId: number, connection: PoolConnection): Promise<void> {
    const [specRows] = await connection.query<SpecRow[]>(
      "SELECT material_id, required_quantity FROM specification_items WHERE order_id = ?",
      [orderId]
    );

    for (const row of specRows) {
      const qty = Number(row.required_quantity);
      await connection.query("UPDATE materials SET current_stock = current_stock - ? WHERE id = ?", [qty, row.material_id]);
      await connection.query(
        "INSERT INTO inventory_transactions (material_id, order_id, tx_type, quantity_change) VALUES (?, ?, 'Списание', ?)",
        [row.material_id, orderId, -qty]
      );
    }
  }
}
