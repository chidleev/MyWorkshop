import api, { type ApiEnvelope } from "./axios";
import type { OrdersQueryParams } from "./orders";

export interface DirectorOrder {
  id: number;
  client_id: number;
  agreement_number: string;
  current_stage: string;
  target_date: string;
  manager_ext_id: string;
  full_name: string;
  phone?: string;
  email?: string | null;
  address?: string | null;
  total_cost?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DirectorOrderMediaItem {
  id: number;
  file_type: string;
  secure_link: string;
  uploaded_at: string;
}

export interface DirectorOrderSpecificationItem {
  material_id: number;
  article: string;
  name: string;
  required_quantity: string;
  sale_price: string;
}

export interface DirectorStatusHistoryEntry {
  id: number;
  stage_name: string;
  transition_date: string;
  employee_ext_id: string;
}

export interface DirectorOrderDetailsResponse {
  order: DirectorOrder;
  specification: DirectorOrderSpecificationItem[];
  media: DirectorOrderMediaItem[];
  status_histories: DirectorStatusHistoryEntry[];
}

export interface RegenerateClosingDocumentsResponse {
  receiptLink: string;
  actLink: string;
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

export async function fetchDirectorOrderDetails(orderId: number) {
  return api.get<unknown, ApiEnvelope<DirectorOrderDetailsResponse>>(`/api/director/orders/${orderId}`);
}

export async function regenerateDirectorOrderDocuments(orderId: number) {
  return api.post<unknown, ApiEnvelope<RegenerateClosingDocumentsResponse>>(
    `/api/director/orders/${orderId}/regenerate-documents`,
    {}
  );
}

export async function fetchWorkload() {
  return api.get<unknown, ApiEnvelope<WorkloadResponse>>("/api/director/workload");
}

export async function fetchProfitability() {
  return api.get<unknown, ApiEnvelope<ProfitabilityRow[]>>("/api/director/profitability");
}
