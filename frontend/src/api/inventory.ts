import api, { type ApiEnvelope } from "./axios";



export interface InventoryItem {

  id: number;

  article: string;

  name: string;

  base_cost: string | number;

  /** Фактический складской остаток (снимок + списания после снимка). */

  physical_stock: string | number;

  /** Сумма строк «Резерв» по материалу (обычно ≤ 0). */

  reserved_change: string | number;

}



export interface TransactionItem {

  id: number;

  tx_date: string;

  tx_type: string;

  quantity_change: string | number;

  order_id: string | null;

  article: string;

  name: string;

}



export interface DeficitItem extends InventoryItem {

  /** Фактический + резерв (для отображения и режима «учитывать резервы»). */

  effective_stock?: string | number;

  /** Рекомендуемое количество к закупке по выбранному режиму. */

  suggested_qty?: string | number;

  total_deficit_cost?: string | number;

}



export interface TransactionsQuery {

  tx_type?: string;

  order_id?: string;

}



export async function fetchInventory(search?: string) {

  return api.get<unknown, ApiEnvelope<InventoryItem[]>>("/api/inventory", {

    params: search ? { search } : undefined,

  });

}



export async function registerIncomingStock(materialId: number, quantity: number) {

  return api.post<unknown, ApiEnvelope<null>>("/api/inventory/incoming", {

    material_id: materialId,

    quantity,

  });

}



export async function fetchTransactions(params?: TransactionsQuery) {

  return api.get<unknown, ApiEnvelope<TransactionItem[]>>("/api/inventory/transactions", {

    params,

  });

}



export async function fetchDeficitReport(params?: { include_reserves?: boolean }) {

  return api.get<unknown, ApiEnvelope<DeficitItem[]>>("/api/inventory/deficit", {

    params: params?.include_reserves ? { include_reserves: 1 } : undefined,

  });

}



export async function createInventoryMaterial(payload: { article: string; name: string; base_cost: number }) {

  return api.post<unknown, ApiEnvelope<{ id: number; article: string; name: string; base_cost: number }>>(

    "/api/inventory/materials",

    payload

  );

}

