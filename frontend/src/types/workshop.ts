export type ProgressStatus = "new" | "in_progress" | "done";

export interface ShiftTask {
  id: number;
  order_id: number;
  order_number: string;
  operation_name: string;
  progress_status: ProgressStatus;
  due_time: string;
}
