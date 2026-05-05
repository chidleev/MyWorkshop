import { computed, ref } from "vue";
import { defineStore } from "pinia";

export const USER_ROLES = [
  "Менеджер",
  "Мастер цеха",
  "Монтажник",
  "Кладовщик",
  "Закупщик",
  "Руководитель",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface UserInfo {
  id: string;
  fullName: string;
  email: string;
}

const TOKEN_KEY = "auth.token";
const ROLE_KEY = "auth.role";
const USER_INFO_KEY = "auth.userInfo";

function readUserInfo(): UserInfo | null {
  const raw = localStorage.getItem(USER_INFO_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as UserInfo;
  } catch {
    return null;
  }
}

function buildUserInfo(role: UserRole): UserInfo {
  const names: Record<UserRole, string> = {
    Менеджер: "Иванова Мария",
    "Мастер цеха": "Смирнов Павел",
    Монтажник: "Козлов Андрей",
    Кладовщик: "Петров Сергей",
    Закупщик: "Соколова Елена",
    Руководитель: "Орлов Дмитрий",
  };

  const slug = role
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-zа-я0-9-]/gi, "");

  return {
    id: `mock-${slug}`,
    fullName: names[role],
    email: `${slug}@my-workshop.local`,
  };
}

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string>(localStorage.getItem(TOKEN_KEY) ?? "");
  const userRole = ref<UserRole | null>(
    (localStorage.getItem(ROLE_KEY) as UserRole | null) ?? null
  );
  const userInfo = ref<UserInfo | null>(readUserInfo());

  const isAuthenticated = computed(() => Boolean(token.value));

  function setSession(nextToken: string, nextRole: UserRole, nextUserInfo: UserInfo) {
    token.value = nextToken;
    userRole.value = nextRole;
    userInfo.value = nextUserInfo;

    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(ROLE_KEY, nextRole);
    localStorage.setItem(USER_INFO_KEY, JSON.stringify(nextUserInfo));
  }

  function clearSession() {
    token.value = "";
    userRole.value = null;
    userInfo.value = null;

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(USER_INFO_KEY);
  }

  function login(role: UserRole) {
    const mockToken = `mock-jwt-token-${role}`;
    const mockUserInfo = buildUserInfo(role);
    setSession(mockToken, role, mockUserInfo);
  }

  function logout() {
    clearSession();
  }

  return {
    token,
    userRole,
    userInfo,
    isAuthenticated,
    login,
    logout,
    setSession,
    clearSession,
  };
});
