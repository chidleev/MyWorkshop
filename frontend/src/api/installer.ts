import api, { type ApiEnvelope } from "./axios";

export interface DeploymentDto {
  order_id: number;
  agreement_number: string;
  current_stage: string;
  target_date: string;
  full_name: string;
  phone: string;
  address: string;
  secure_link: string | null;
}

export async function fetchDeployments() {
  return api.get<unknown, ApiEnvelope<DeploymentDto[]>>("/api/workshop/deployments");
}
