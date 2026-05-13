import { describe, it, expect, vi } from "vitest";
import type { PoolConnection } from "mysql2/promise";
import { InventoryService } from "../src/services/InventoryService";
import { AppError } from "../src/utils/AppError";

describe("InventoryService.assertReserveConversionWontCauseNegativePhysicalStock", () => {
  it("does not throw when there are no reserve rows for the order", async () => {
    const connection = {
      query: vi.fn().mockResolvedValue([[], []])
    } as unknown as PoolConnection;

    await expect(
      InventoryService.assertReserveConversionWontCauseNegativePhysicalStock(1, connection)
    ).resolves.toBeUndefined();
  });

  it("does not throw when projected physical stock is non-negative", async () => {
    const connection = {
      query: vi.fn().mockResolvedValue([
        [
          {
            material_id: 1,
            physical_now: "10.000",
            reserve_qty_sum: "-3.000"
          }
        ],
        []
      ])
    } as unknown as PoolConnection;

    await expect(
      InventoryService.assertReserveConversionWontCauseNegativePhysicalStock(1, connection)
    ).resolves.toBeUndefined();
  });

  it("throws 409 when projected physical stock would be negative", async () => {
    const connection = {
      query: vi.fn().mockResolvedValue([
        [
          {
            material_id: 1,
            physical_now: "2.000",
            reserve_qty_sum: "-5.000"
          }
        ],
        []
      ])
    } as unknown as PoolConnection;

    await expect(
      InventoryService.assertReserveConversionWontCauseNegativePhysicalStock(1, connection)
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof AppError &&
        err.statusCode === 409 &&
        err.message.includes("Недостаточно материала")
      );
    });
  });
});
