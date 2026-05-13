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

const TASK_STATUS_BY_PROGRESS = {
  new: "Ожидает",
  in_progress: "В работе",
  done: "Завершен",
} as const;

export async function updateWorkshopTaskStatus(taskId: number, status: "new" | "in_progress" | "done") {
  return api.patch<unknown, ApiEnvelope<null>>(`/api/workshop/tasks/${taskId}/status`, {
    status: TASK_STATUS_BY_PROGRESS[status],
  });
}
