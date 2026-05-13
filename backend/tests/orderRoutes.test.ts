import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/app";
import { dbPool } from "../src/config/db";
import { CrmAdapter } from "../src/services/CrmAdapter";
import { AppError } from "../src/utils/AppError";

vi.mock("../src/config/db", () => ({
  dbPool: {
    query: vi.fn(),
    getConnection: vi.fn()
  }
}));

vi.mock("../src/services/CrmAdapter", () => ({
  CrmAdapter: {
    verifyToken: vi.fn()
  }
}));

describe("Order API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create an order successfully", async () => {
    // Mock token verification
    vi.mocked(CrmAdapter.verifyToken).mockResolvedValue({
      id: "manager-123",
      role: "Менеджер",
      name: "Test Manager"
    });

    const mockConnection = {
      beginTransaction: vi.fn(),
      query: vi.fn()
        .mockResolvedValueOnce([{ insertId: 10 } as any, [] as any])
        .mockResolvedValueOnce([{ insertId: 1 } as any, [] as any])
        .mockResolvedValueOnce([{} as any, [] as any]),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn()
    };
    vi.mocked(dbPool.getConnection).mockResolvedValue(mockConnection as any);

    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", "Bearer valid_token")
      .send({
        full_name: "Иван Петров",
        phone: "+7 (999) 999-99-99",
        email: "ivan@example.com",
        address: "Москва, ул. Тестовая, 1",
        agreement_number: "AG-001",
        target_date: "2026-12-31"
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("success");
    expect(response.body.data.id).toBe(1);
    expect(response.body.data.client_id).toBe(10);
    expect(mockConnection.query).toHaveBeenCalledWith(
      "INSERT INTO clients (full_name, phone, email, address) VALUES (?, ?, ?, ?)",
      ["Иван Петров", "+7 (999) 999-99-99", "ivan@example.com", "Москва, ул. Тестовая, 1"]
    );
    expect(mockConnection.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO orders"),
      [10, "manager-123", "AG-001", "2026-12-31"]
    );
    expect(mockConnection.query).toHaveBeenCalledWith(
      "INSERT INTO status_histories (order_id, stage_name, employee_ext_id) VALUES (?, ?, ?)",
      [1, "Новый", "manager-123"]
    );
    expect(mockConnection.beginTransaction).toHaveBeenCalled();
    expect(mockConnection.commit).toHaveBeenCalled();
    expect(mockConnection.release).toHaveBeenCalled();
  });

  it("should auto-generate agreement_number when omitted on create", async () => {
    vi.mocked(CrmAdapter.verifyToken).mockResolvedValue({
      id: "manager-123",
      role: "Менеджер",
      name: "Test Manager"
    });

    const mockConnection = {
      beginTransaction: vi.fn(),
      query: vi.fn()
        .mockResolvedValueOnce([{ insertId: 20 } as any, [] as any])
        .mockResolvedValueOnce([{ insertId: 7 } as any, [] as any])
        .mockResolvedValueOnce([{} as any, [] as any])
        .mockResolvedValueOnce([{} as any, [] as any]),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn()
    };
    vi.mocked(dbPool.getConnection).mockResolvedValue(mockConnection as any);

    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", "Bearer valid_token")
      .send({
        full_name: "Авто Номер",
        email: "auto@example.com",
        address: "Адрес",
        target_date: "2026-12-31"
      });

    expect(response.status).toBe(201);
    expect(mockConnection.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO orders"),
      [20, "manager-123", null, "2026-12-31"]
    );
    expect(mockConnection.query).toHaveBeenCalledWith(
      "UPDATE orders SET agreement_number = ? WHERE id = ?",
      [`MM-${new Date().getFullYear()}-0007`, 7]
    );
    expect(mockConnection.commit).toHaveBeenCalled();
  });

  it("should create an order without phone", async () => {
    vi.mocked(CrmAdapter.verifyToken).mockResolvedValue({
      id: "manager-123",
      role: "Менеджер",
      name: "Test Manager"
    });

    const mockConnection = {
      beginTransaction: vi.fn(),
      query: vi.fn()
        .mockResolvedValueOnce([{ insertId: 11 } as any, [] as any])
        .mockResolvedValueOnce([{ insertId: 2 } as any, [] as any])
        .mockResolvedValueOnce([{} as any, [] as any]),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn()
    };
    vi.mocked(dbPool.getConnection).mockResolvedValue(mockConnection as any);

    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", "Bearer valid_token")
      .send({
        full_name: "Без Телефона",
        email: "only@example.com",
        address: "Адрес",
        agreement_number: "AG-002",
        target_date: "2026-12-31"
      });

    expect(response.status).toBe(201);
    expect(mockConnection.query).toHaveBeenCalledWith(
      "INSERT INTO clients (full_name, phone, email, address) VALUES (?, ?, ?, ?)",
      ["Без Телефона", null, "only@example.com", "Адрес"]
    );
  });

  it("should return 401 if token is invalid", async () => {
    vi.mocked(CrmAdapter.verifyToken).mockRejectedValue(new AppError(401, "Недействительный токен"));

    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", "Bearer invalid_token")
      .send({
        client_id: 1
      });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Недействительный токен");
  });

  it("should list orders", async () => {
    vi.mocked(CrmAdapter.verifyToken).mockResolvedValue({
      id: "manager-123",
      role: "Менеджер",
      name: "Test Manager"
    });

    vi.mocked(dbPool.query).mockResolvedValue([
      [{ id: 1, agreement_number: "AG-001" }],
      [] as any
    ]);

    const response = await request(app)
      .get("/api/orders")
      .set("Authorization", "Bearer valid_token");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].agreement_number).toBe("AG-001");
  });

  it("should list web applications for manager", async () => {
    vi.mocked(CrmAdapter.verifyToken).mockResolvedValue({
      id: "manager-123",
      role: "Менеджер",
      name: "Test Manager"
    });

    vi.mocked(dbPool.query).mockResolvedValue([
      [
        {
          id: 99,
          agreement_number: "WEB-999",
          manager_ext_id: "system_web_lead",
          current_stage: "Новый",
          full_name: "Site",
          email: "site@example.com"
        }
      ],
      [] as any
    ]);

    const response = await request(app)
      .get("/api/orders/web-applications")
      .set("Authorization", "Bearer valid_token");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].agreement_number).toBe("WEB-999");
  });

  it("should update an order", async () => {
    vi.mocked(CrmAdapter.verifyToken).mockResolvedValue({
      id: "manager-123",
      role: "Менеджер",
      name: "Test Manager"
    });

    const mockConnection = {
      beginTransaction: vi.fn(),
      query: vi.fn().mockResolvedValue([]),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn()
    };
    vi.mocked(dbPool.getConnection).mockResolvedValue(mockConnection as any);

    vi.mocked(dbPool.query).mockResolvedValue([
      [{ manager_ext_id: "manager-123", client_id: 1 }],
      [] as any
    ]);

    const response = await request(app)
      .put("/api/orders/1")
      .set("Authorization", "Bearer valid_token")
      .send({
        target_date: "2026-10-10"
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(mockConnection.query).toHaveBeenCalledWith(
      expect.stringMatching(
        /UPDATE orders SET\s+agreement_number = COALESCE\(\?, agreement_number\),\s+target_date = COALESCE\(\?, target_date\),\s+updated_at = CURRENT_TIMESTAMP\(3\)\s+WHERE id = \?/
      ),
      [null, "2026-10-10", 1]
    );
  });

  it("should delete order in Новый status", async () => {
    vi.mocked(CrmAdapter.verifyToken).mockResolvedValue({
      id: "manager-123",
      role: "Менеджер",
      name: "Test Manager"
    });

    vi.mocked(dbPool.query)
      .mockResolvedValueOnce([[{ manager_ext_id: "manager-123", current_stage: "Новый" }], [] as any])
      .mockResolvedValueOnce([[] as any, [] as any])
      .mockResolvedValueOnce([{ affectedRows: 1 } as any, [] as any]);

    const response = await request(app)
      .delete("/api/orders/1")
      .set("Authorization", "Bearer valid_token");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should reject delete when order is already in production", async () => {
    vi.mocked(CrmAdapter.verifyToken).mockResolvedValue({
      id: "manager-123",
      role: "Менеджер",
      name: "Test Manager"
    });

    vi.mocked(dbPool.query).mockResolvedValueOnce([
      [{ manager_ext_id: "manager-123", current_stage: "В производстве" }],
      [] as any
    ]);

    const response = await request(app)
      .delete("/api/orders/1")
      .set("Authorization", "Bearer valid_token");

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Отменить можно только заказ, ещё не принятый в производство.");
  });
});
