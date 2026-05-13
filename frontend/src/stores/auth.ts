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

export interface EmployeeOption {
  id: string;
  fullName: string;
  role: UserRole;
}

export interface UserInfo {
  id: string;
  fullName: string;
  email: string;
}

export const MOCK_EMPLOYEES: EmployeeOption[] = [
  { id: "crm-manager-001", fullName: "Иванова Мария", role: "Менеджер" },
  { id: "crm-manager-002", fullName: "Павлов Артем", role: "Менеджер" },
  { id: "crm-manager-003", fullName: "Петров Илья", role: "Менеджер" },
  { id: "master-cutting-001", fullName: "Смирнов Павел", role: "Мастер цеха" },
  { id: "master-edging-001", fullName: "Федоров Никита", role: "Мастер цеха" },
  { id: "master-drilling-001", fullName: "Волков Антон", role: "Мастер цеха" },
  { id: "master-assembly-001", fullName: "Громов Сергей", role: "Мастер цеха" },
  { id: "installer-001", fullName: "Козлов Андрей", role: "Монтажник" },
  { id: "storekeeper-001", fullName: "Петров Сергей", role: "Кладовщик" },
  { id: "buyer-001", fullName: "Соколова Елена", role: "Закупщик" },
  { id: "director-001", fullName: "Орлов Дмитрий", role: "Руководитель" },
];

const TOKEN_KEY = "auth.token";
const ROLE_KEY = "auth.role";
const USER_INFO_KEY = "auth.userInfo";

const ROLE_TOKEN_KEYS: Record<UserRole, string> = {
  Менеджер: "manager",
  "Мастер цеха": "master",
  Монтажник: "installer",
  Кладовщик: "storekeeper",
  Закупщик: "buyer",
  Руководитель: "director",
};

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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-zа-я0-9-]/gi, "");
}

function buildMockToken(role: UserRole, employeeExtId: string) {
  return `mock:${ROLE_TOKEN_KEYS[role]}:${employeeExtId}`;
}

function buildUserInfo(role: UserRole, employeeExtId: string): UserInfo {
  const employee = MOCK_EMPLOYEES.find((item) => item.role === role && item.id === employeeExtId);
  const slug = slugify(employeeExtId);

  return {
    id: employeeExtId,
    fullName: employee?.fullName ?? employeeExtId,
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

  function login(role: UserRole, employeeExtId: string) {
    const mockToken = buildMockToken(role, employeeExtId);
    const mockUserInfo = buildUserInfo(role, employeeExtId);
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
