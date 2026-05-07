import api, { type ApiEnvelope } from "./axios";
import type { OrdersQueryParams } from "./orders";

export interface DirectorOrder {
  id: number;
  agreement_number: string;
  current_stage: string;
  target_date: string;
  manager_ext_id: string;
  full_name: string;
}

export interface WorkloadResponse {
  [operation: string]: {
    [status: string]: number;
  };
}

export interface ProfitabilityRow {
  order_id: number;
  agreement_number: string;
  client_name: string;
  revenue: number;
  cogs: number;
  profit: number;
  margin_percent: number;
}

export async function fetchGlobalOrders(params?: OrdersQueryParams) {
  return api.get<unknown, ApiEnvelope<DirectorOrder[]>>("/api/director/orders", { params });
}

export async function fetchWorkload() {
  return api.get<unknown, ApiEnvelope<WorkloadResponse>>("/api/director/workload");
}

export async function fetchProfitability() {
  return api.get<unknown, ApiEnvelope<ProfitabilityRow[]>>("/api/director/profitability");
}
