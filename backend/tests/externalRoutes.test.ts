import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/app";
import { dbPool } from "../src/config/db";

vi.mock("../src/config/db", () => ({
  dbPool: {
    getConnection: vi.fn()
  }
}));

describe("External API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a lead successfully", async () => {
    const mockConnection = {
      beginTransaction: vi.fn(),
      query: vi.fn()
        .mockResolvedValueOnce([{ insertId: 10 } as any, [] as any]) // client insert
        .mockResolvedValueOnce([{ insertId: 20 } as any, [] as any]) // order insert
        .mockResolvedValueOnce([{} as any, [] as any]), // status_histories
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn()
    };
    vi.mocked(dbPool.getConnection).mockResolvedValue(mockConnection as any);

    const response = await request(app)
      .post("/api/external/leads")
      .send({
        client_name: "Test Client",
        client_email: "client@example.com",
        client_phone: "+1234567890",
        comment: "Kitchen project"
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("success");
    expect(response.body.data.client_id).toBe(10);
    expect(response.body.data.order_id).toBe(20);
    expect(response.body.data.agreement_number).toMatch(/^WEB-\d+$/);
    expect(mockConnection.query).toHaveBeenCalledWith(
      "INSERT INTO clients (full_name, phone, email, address) VALUES (?, ?, ?, ?)",
      ["Test Client", "+1234567890", "client@example.com", "Комментарий заявки: Kitchen project"]
    );
    expect(mockConnection.query).toHaveBeenCalledWith(
      "INSERT INTO status_histories (order_id, stage_name, employee_ext_id) VALUES (?, ?, ?)",
      [20, "Новый", "system_web_lead"]
    );
    expect(mockConnection.beginTransaction).toHaveBeenCalled();
    expect(mockConnection.commit).toHaveBeenCalled();
    expect(mockConnection.release).toHaveBeenCalled();
  });

  it("should create a lead without phone", async () => {
    const mockConnection = {
      beginTransaction: vi.fn(),
      query: vi.fn()
        .mockResolvedValueOnce([{ insertId: 11 } as any, [] as any])
        .mockResolvedValueOnce([{ insertId: 21 } as any, [] as any])
        .mockResolvedValueOnce([{} as any, [] as any]),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn()
    };
    vi.mocked(dbPool.getConnection).mockResolvedValue(mockConnection as any);

    const response = await request(app)
      .post("/api/external/leads")
      .send({
        client_name: "No Phone",
        client_email: "nop@example.com"
      });

    expect(response.status).toBe(201);
    expect(mockConnection.query).toHaveBeenCalledWith(
      "INSERT INTO clients (full_name, phone, email, address) VALUES (?, ?, ?, ?)",
      ["No Phone", null, "nop@example.com", null]
    );
  });

  it("should create a lead when only email field is sent (alias for client_email)", async () => {
    const mockConnection = {
      beginTransaction: vi.fn(),
      query: vi.fn()
        .mockResolvedValueOnce([{ insertId: 12 } as any, [] as any])
        .mockResolvedValueOnce([{ insertId: 22 } as any, [] as any])
        .mockResolvedValueOnce([{} as any, [] as any]),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn()
    };
    vi.mocked(dbPool.getConnection).mockResolvedValue(mockConnection as any);

    const response = await request(app)
      .post("/api/external/leads")
      .send({
        client_name: "Alias Test",
        email: "alias@example.com"
      });

    expect(response.status).toBe(201);
    expect(mockConnection.query).toHaveBeenCalledWith(
      "INSERT INTO clients (full_name, phone, email, address) VALUES (?, ?, ?, ?)",
      ["Alias Test", null, "alias@example.com", null]
    );
  });

  it("should return 400 if validation fails (no email)", async () => {
    const response = await request(app)
      .post("/api/external/leads")
      .send({
        client_name: "Test Client",
        client_phone: "+79990000000"
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Ошибка валидации");
  });
});
