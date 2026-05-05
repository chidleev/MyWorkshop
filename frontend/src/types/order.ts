export type OrderStatus =
  | "new"
  | "cutting"
  | "edging"
  | "assembly"
  | "ready_to_ship";

export interface Order {
  id: number;
  agreement_number: string;
  client_id: string;
  manager_ext_id: string;
  full_name: string;
  phone: string;
  email: string;
  address: string;
  status: OrderStatus;
  target_date: string;
  total_cost: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderFormPayload {
  full_name: string;
  phone: string;
  email: string;
  address: string;
  agreement_number: string;
  target_date: string;
}
