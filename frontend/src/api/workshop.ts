import api, { type ApiEnvelope } from "./axios";

export interface WorkshopTaskDto {
  id: number;
  order_id: number;
  agreement_number: string;
  operation_name: string;
  progress_status: string;
  target_date: string;
}

export async function fetchTasks(status?: string) {
  return api.get<unknown, ApiEnvelope<WorkshopTaskDto[]>>("/api/workshop/tasks", {
    params: status ? { status } : undefined,
  });
}
