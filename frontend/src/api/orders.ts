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
  phone: string;
}

export interface SpecificationResponseItem {
  article: string;
  name: string;
  required_quantity: string;
  unit_price: string;
  amount: string;
}

export async function fetchOrders(params?: OrdersQueryParams) {
  return api.get<unknown, ApiEnvelope<OrderDto[]>>("/api/orders", { params });
}

export async function createOrder(data: OrderFormPayload) {
  return api.post<unknown, ApiEnvelope<{ id: number }>>("/api/orders", {
    client_id: 1,
    agreement_number: data.agreement_number,
    target_date: data.target_date,
  });
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
  return api.post<
    unknown,
    ApiEnvelope<{ total_cost: string; items: SpecificationResponseItem[] }>
  >(`/api/orders/${orderId}/specification`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export async function updateOrderStatus(orderId: number, status: string) {
  return api.patch<unknown, ApiEnvelope<null>>(`/api/orders/${orderId}/status`, { status });
}
