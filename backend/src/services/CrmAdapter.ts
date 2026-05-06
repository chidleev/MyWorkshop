import { AppError } from "../utils/AppError";
import type { UserProfile } from "../types/auth";

function buildMockProfile(token: string): UserProfile {
  const roleMap: Record<string, string> = {
    manager: "Менеджер",
    director: "Руководитель",
    master: "Мастер цеха",
    installer: "Монтажник",
    buyer: "Закупщик",
    storekeeper: "Кладовщик"
  };

  const roleKey = token.split("-").at(-1) ?? "manager";
  return {
    id: `mock_${roleKey}`,
    fullName: `Mock ${roleMap[roleKey] ?? "Сотрудник"}`,
    role: roleMap[roleKey] ?? "Менеджер"
  };
}

export class CrmAdapter {
  static async verifyToken(token: string): Promise<UserProfile> {
    if (!token) {
      throw new AppError(401, "Недействительный токен");
    }

    const useMock = process.env.USE_MOCK_CRM === "true" || !process.env.CRM_API_URL;
    if (useMock) {
      return buildMockProfile(token);
    }

    try {
      const response = await fetch(`${process.env.CRM_API_URL}/verify`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401) {
        throw new AppError(401, "Недействительный токен");
      }
      if (!response.ok) {
        throw new AppError(503, "CRM недоступна");
      }
      return (await response.json()) as UserProfile;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(503, "Ошибка связи с CRM");
    }
  }
}
