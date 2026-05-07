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

describe("Workshop API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return tasks for master", async () => {
    vi.mocked(CrmAdapter.verifyToken).mockResolvedValue({
      id: "master-1",
      role: "Мастер цеха",
      name: "Test Master"
    });

    vi.mocked(dbPool.query).mockResolvedValue([
      [{ id: 1, operation_name: "Распил", progress_status: "Ожидает" }],
      [] as any
    ]);

    const response = await request(app)
      .get("/api/workshop/tasks")
      .set("Authorization", "Bearer valid_token");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].operation_name).toBe("Распил");
  });

  it("should return deployments for installer", async () => {
    vi.mocked(CrmAdapter.verifyToken).mockResolvedValue({
      id: "installer-1",
      role: "Монтажник",
      name: "Test Installer"
    });

    vi.mocked(dbPool.query).mockResolvedValue([
      [{ order_id: 1, agreement_number: "AG-001", current_stage: "Готов к отгрузке" }],
      [] as any
    ]);

    const response = await request(app)
      .get("/api/installer/deployments")
      .set("Authorization", "Bearer valid_token");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].agreement_number).toBe("AG-001");
  });
});
