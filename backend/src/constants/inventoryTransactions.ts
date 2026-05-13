/** Типы складских движений в `inventory_transactions.tx_type` */
export const INV_TX = {
  RESERVE: "Резерв",
  CONSUMPTION: "Списание",
  INCOMING: "Приход",
} as const;

/**
 * Фактический остаток: снимок на момент `stock_snapshot_at` плюс все списания позже этого момента.
 * Приходы учитываются в `stock_snapshot` при оформлении прихода, в сумму не входят.
 */
export function physicalStockExpression(materialAlias: string): string {
  return `(${materialAlias}.stock_snapshot + COALESCE((
    SELECT SUM(t.quantity_change)
    FROM inventory_transactions t
    WHERE t.material_id = ${materialAlias}.id
      AND t.tx_type = '${INV_TX.CONSUMPTION}'
      AND t.tx_date > ${materialAlias}.stock_snapshot_at
  ), 0))`;
}

/** Сумма строк резерва по материалу (отрицательное число или NULL → 0). */
export function reservedSumExpression(materialAlias: string): string {
  return `COALESCE((
    SELECT SUM(t.quantity_change)
    FROM inventory_transactions t
    WHERE t.material_id = ${materialAlias}.id AND t.tx_type = '${INV_TX.RESERVE}'
  ), 0)`;
}
