import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/app";
import { dbPool } from "../src/config/db";
import { CrmAdapter } from "../src/services/CrmAdapter";

vi.mock("../src/config/db", () => ({
  dbPool: {
    query: vi.fn()
  }
}));

vi.mock("../src/services/CrmAdapter", () => ({
  CrmAdapter: {
    verifyToken: vi.fn()
  }
}));

describe("Director API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return orders for director", async () => {
    vi.mocked(CrmAdapter.verifyToken).mockResolvedValue({
      id: "director-1",
      role: "Руководитель",
      name: "Test Director"
    });

    vi.mocked(dbPool.query).mockResolvedValue([
      [{ id: 1, agreement_number: "AG-001" }],
      [] as any
    ]);

    const response = await request(app)
      .get("/api/director/orders")
      .set("Authorization", "Bearer valid_token");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].agreement_number).toBe("AG-001");
  });

  it("should return profitability", async () => {
    vi.mocked(CrmAdapter.verifyToken).mockResolvedValue({
      id: "director-1",
      role: "Руководитель",
      name: "Test Director"
    });

    vi.mocked(dbPool.query).mockResolvedValue([
      [
        {
          order_id: 1,
          agreement_number: "AG-001",
          client_name: "Test Client",
          revenue: 1000,
          cogs: 600,
          profit: 400
        }
      ],
      [] as any
    ]);

    const response = await request(app)
      .get("/api/director/profitability")
      .set("Authorization", "Bearer valid_token");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].margin_percent).toBe(40);
  });

  it("should return workload", async () => {
    vi.mocked(CrmAdapter.verifyToken).mockResolvedValue({
      id: "director-1",
      role: "Руководитель",
      name: "Test Director"
    });

    vi.mocked(dbPool.query).mockResolvedValue([
      [
        { operation_name: "Распил", progress_status: "В работе", task_count: 5 },
        { operation_name: "Распил", progress_status: "Завершено", task_count: 10 }
      ],
      [] as any
    ]);

    const response = await request(app)
      .get("/api/director/workload")
      .set("Authorization", "Bearer valid_token");

    expect(response.status).toBe(200);
    expect(response.body.data["Распил"]["В работе"]).toBe(5);
    expect(response.body.data["Распил"]["Завершено"]).toBe(10);
  });
});
