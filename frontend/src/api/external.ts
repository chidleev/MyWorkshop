import api, { type ApiEnvelope } from "./axios";

export interface LeadPayload {
  client_name: string;
  client_email: string;
  client_phone?: string;
  comment?: string;
}

export interface LeadResponse {
  client_id: number;
  order_id: number;
  agreement_number: string;
}

export async function createExternalLead(payload: LeadPayload) {
  return api.post<unknown, ApiEnvelope<LeadResponse>>("/api/external/leads", {
    ...payload,
    email: payload.client_email,
  });
}
