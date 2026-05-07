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
    process.env.EXTERNAL_API_KEY = "test_api_key";
  });

  it("should create a lead successfully", async () => {
    const mockConnection = {
      beginTransaction: vi.fn(),
      query: vi.fn()
        .mockResolvedValueOnce([{ insertId: 10 } as any, [] as any]) // client insert
        .mockResolvedValueOnce([{ insertId: 20 } as any, [] as any]), // order insert
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn()
    };
    vi.mocked(dbPool.getConnection).mockResolvedValue(mockConnection as any);

    const response = await request(app)
      .post("/api/external/leads")
      .set("X-API-KEY", "test_api_key")
      .send({
        client_name: "Test Client",
        client_phone: "+1234567890"
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("success");
    expect(response.body.data.client_id).toBe(10);
    expect(response.body.data.order_id).toBe(20);
    expect(mockConnection.beginTransaction).toHaveBeenCalled();
    expect(mockConnection.commit).toHaveBeenCalled();
    expect(mockConnection.release).toHaveBeenCalled();
  });

  it("should return 401 if API key is invalid", async () => {
    const response = await request(app)
      .post("/api/external/leads")
      .set("X-API-KEY", "wrong_key")
      .send({
        client_name: "Test Client",
        client_phone: "+1234567890"
      });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized");
  });

  it("should return 400 if validation fails", async () => {
    const response = await request(app)
      .post("/api/external/leads")
      .set("X-API-KEY", "test_api_key")
      .send({
        client_name: "Test Client"
        // missing client_phone
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Ошибка валидации");
  });
});
