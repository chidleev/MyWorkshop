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

    // Mock DB insert
    vi.mocked(dbPool.query).mockResolvedValue([{ insertId: 1 } as any, [] as any]);

    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", "Bearer valid_token")
      .send({
        client_id: 1,
        agreement_number: "AG-001",
        target_date: "2026-12-31"
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("success");
    expect(response.body.data.id).toBe(1);
    expect(dbPool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO orders"),
      [1, "manager-123", "AG-001", "2026-12-31"]
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
      expect.stringContaining("UPDATE orders SET agreement_number = COALESCE(?, agreement_number), target_date = COALESCE(?, target_date) WHERE id = ?"),
      [null, "2026-10-10", 1]
    );
  });
});
