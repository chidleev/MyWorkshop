import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/app";
import { dbPool } from "../src/config/db";
import { CrmAdapter } from "../src/services/CrmAdapter";

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

describe("Inventory API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return inventory list", async () => {
    vi.mocked(CrmAdapter.verifyToken).mockResolvedValue({
      id: "storekeeper-1",
      role: "Кладовщик",
      name: "Test Storekeeper"
    });

    vi.mocked(dbPool.query).mockResolvedValue([
      [{ id: 1, name: "Material 1", current_stock: 10 }],
      [] as any
    ]);

    const response = await request(app)
      .get("/api/inventory")
      .set("Authorization", "Bearer valid_token");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].name).toBe("Material 1");
  });

  it("should add incoming stock", async () => {
    vi.mocked(CrmAdapter.verifyToken).mockResolvedValue({
      id: "storekeeper-1",
      role: "Кладовщик",
      name: "Test Storekeeper"
    });

    const mockConnection = {
      beginTransaction: vi.fn(),
      query: vi.fn().mockResolvedValue([]),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn()
    };
    vi.mocked(dbPool.getConnection).mockResolvedValue(mockConnection as any);

    const response = await request(app)
      .post("/api/inventory/incoming")
      .set("Authorization", "Bearer valid_token")
      .send({
        material_id: 1,
        quantity: 50
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(mockConnection.query).toHaveBeenCalledWith(
      "UPDATE materials SET current_stock = current_stock + ? WHERE id = ?",
      [50, 1]
    );
  });

  it("should return deficit", async () => {
    vi.mocked(CrmAdapter.verifyToken).mockResolvedValue({
      id: "buyer-1",
      role: "Закупщик",
      name: "Test Buyer"
    });

    vi.mocked(dbPool.query).mockResolvedValue([
      [{ id: 1, name: "Material 1", current_stock: -5, total_deficit_cost: 500 }],
      [] as any
    ]);

    const response = await request(app)
      .get("/api/inventory/deficit")
      .set("Authorization", "Bearer valid_token");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.total_budget).toBe(500);
  });
});
