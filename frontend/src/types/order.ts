export type OrderStatus =
  | "new"
  | "in_production"
  | "ready_to_ship"
  | "completed";

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
  production_stage: string | null;
  has_specification: boolean;
  tasks_total_count: number;
  tasks_started_count: number;
  tasks_completed_count: number;
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
  manager_ext_id?: string;
}
