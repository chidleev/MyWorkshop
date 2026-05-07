import api, { type ApiEnvelope } from "./axios";

export interface MediaFileDto {
  id: number;
  order_id: number;
  file_type: string;
  secure_link: string;
  uploaded_at: string;
}

export async function uploadMedia(orderId: number, file: File, type = "Фото") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("file_type", type);

  return api.post<unknown, ApiEnvelope<{ secure_link: string }>>(`/api/orders/${orderId}/media`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export async function fetchOrderMedia(orderId: number, fileType?: string) {
  return api.get<unknown, ApiEnvelope<MediaFileDto[]>>(`/api/orders/${orderId}/media`, {
    params: fileType ? { file_type: fileType } : undefined,
  });
}
