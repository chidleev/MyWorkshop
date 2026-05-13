import api, { type ApiEnvelope } from "./axios";
import type { OrderFormPayload } from "../types/order";

export interface OrdersQueryParams {
  status?: string;
  manager_id?: string;
  target_date?: string;
  is_overdue?: boolean;
}

export interface OrderDto {
  id: number;
  client_id: number;
  manager_ext_id: string;
  agreement_number: string;
  target_date: string;
  total_cost: string | null;
  current_stage: string;
  created_at: string;
  updated_at: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  production_stage: string | null;
  has_specification: boolean | number;
  tasks_total_count: number | string;
  tasks_started_count: number | string;
  tasks_completed_count: number | string;
}

export interface SpecificationResponseItem {
  row_id: string;
  article: string;
  name: string;
  required_quantity: string;
  unit_price: string;
  amount: string;
  missing_material: boolean;
}

export type PricingMarkupMode = "none" | "percent" | "fixed" | "coefficient" | "margin_on_price";

export interface OrderSpecificationResponse {
  total_cost: string;
  materials_subtotal: string;
  pricing_markup_mode: PricingMarkupMode;
  pricing_markup_value: string;
  markup_amount: string;
  items: SpecificationResponseItem[];
}

export interface SpecificationMutationResponse {
  committed: boolean;
  total_cost: string;
  materials_subtotal: string;
  pricing_markup_mode: PricingMarkupMode;
  pricing_markup_value: string;
  markup_amount: string;
  items: SpecificationResponseItem[];
  has_missing_materials: boolean;
}

export interface PricingMarkupPatchResponse {
  materials_subtotal: string;
  pricing_markup_mode: PricingMarkupMode;
  pricing_markup_value: string;
  markup_amount: string;
  total_cost: string;
}

export async function fetchOrders(params?: OrdersQueryParams) {
  return api.get<unknown, ApiEnvelope<OrderDto[]>>("/api/orders", { params });
}

export async function createOrder(data: OrderFormPayload) {
  const payload: OrderFormPayload = {
    full_name: data.full_name ?? "",
    phone: data.phone ?? "",
    email: data.email ?? "",
    address: data.address ?? "",
    agreement_number: data.agreement_number ?? "",
    target_date: data.target_date ?? "",
    manager_ext_id: data.manager_ext_id,
  };

  return api.post<unknown, ApiEnvelope<{ id: number; client_id: number }>>("/api/orders", payload);
}

export async function updateOrder(id: number, data: OrderFormPayload) {
  return api.put<unknown, ApiEnvelope<null>>(`/api/orders/${id}`, data);
}

export async function deleteOrder(id: number) {
  return api.delete<unknown, ApiEnvelope<null>>(`/api/orders/${id}`);
}

export async function uploadSpecification(orderId: number, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return api.post<unknown, ApiEnvelope<SpecificationMutationResponse>>(
    `/api/orders/${orderId}/specification`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    }
  );
}

export async function previewOrderSpecification(orderId: number, rows: Array<{ article: string; quantity: number }>) {
  return api.post<unknown, ApiEnvelope<SpecificationMutationResponse>>(
    `/api/orders/${orderId}/specification/preview`,
    { rows }
  );
}

export async function commitOrderSpecification(orderId: number, rows: Array<{ article: string; quantity: number }>) {
  return api.post<unknown, ApiEnvelope<SpecificationMutationResponse>>(
    `/api/orders/${orderId}/specification/commit`,
    { rows }
  );
}

export async function fetchOrderSpecification(orderId: number) {
  return api.get<unknown, ApiEnvelope<OrderSpecificationResponse>>(`/api/orders/${orderId}/specification`);
}

export async function patchOrderPricingMarkup(
  orderId: number,
  payload: { pricing_markup_mode: PricingMarkupMode; pricing_markup_value: number }
) {
  return api.patch<unknown, ApiEnvelope<PricingMarkupPatchResponse>>(
    `/api/orders/${orderId}/pricing-markup`,
    payload
  );
}

export async function updateOrderStatus(orderId: number, status: string) {
  return api.patch<unknown, ApiEnvelope<null>>(`/api/orders/${orderId}/status`, { status });
}

export async function fetchWebApplications() {
  return api.get<unknown, ApiEnvelope<OrderDto[]>>("/api/orders/web-applications");
}

export interface ClaimWebApplicationPayload {
  agreement_number?: string;
  target_date: string;
  full_name?: string;
  phone?: string;
  email: string;
  address?: string;
}

export async function claimWebApplication(id: number, payload: ClaimWebApplicationPayload) {
  return api.post<unknown, ApiEnvelope<null>>(`/api/orders/web-applications/${id}/claim`, payload);
}

export async function rejectWebApplication(id: number) {
  return api.post<unknown, ApiEnvelope<null>>(`/api/orders/web-applications/${id}/reject`, {});
}
