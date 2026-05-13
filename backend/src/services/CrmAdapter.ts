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

  const employeeNames: Record<string, string> = {
    "crm-manager-001": "Иванова Мария",
    "crm-manager-002": "Павлов Артем",
    "crm-manager-003": "Петров Илья",
    "master-cutting-001": "Смирнов Павел",
    "master-edging-001": "Федоров Никита",
    "master-drilling-001": "Волков Антон",
    "master-assembly-001": "Громов Сергей",
    "installer-001": "Козлов Андрей",
    "storekeeper-001": "Петров Сергей",
    "buyer-001": "Соколова Елена",
    "director-001": "Орлов Дмитрий"
  };

  const mockTokenParts = token.startsWith("mock:") ? token.split(":") : [];
  const roleKey = mockTokenParts[1] ?? token.split("-").at(-1) ?? "manager";
  const employeeExtId = mockTokenParts.slice(2).join(":") || `mock_${roleKey}`;
  const role = roleMap[roleKey] ?? (Object.values(roleMap).includes(roleKey) ? roleKey : "Менеджер");

  return {
    id: employeeExtId,
    fullName: employeeNames[employeeExtId] ?? `Mock ${role}`,
    role
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
