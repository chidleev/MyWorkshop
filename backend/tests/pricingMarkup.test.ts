import { describe, it, expect } from "vitest";
import { computeClientTotalWithMarkup } from "../src/services/PricingService";

describe("computeClientTotalWithMarkup", () => {
  it("applies percent", () => {
    const r = computeClientTotalWithMarkup(1000, "percent", 15);
    expect(r.clientTotal).toBe(1150);
    expect(r.markupAmount).toBe(150);
  });

  it("applies fixed", () => {
    const r = computeClientTotalWithMarkup(8000, "fixed", 2500);
    expect(r.clientTotal).toBe(10500);
    expect(r.markupAmount).toBe(2500);
  });

  it("applies coefficient", () => {
    const r = computeClientTotalWithMarkup(10000, "coefficient", 1.2);
    expect(r.clientTotal).toBe(12000);
    expect(r.markupAmount).toBe(2000);
  });

  it("applies margin on price", () => {
    const r = computeClientTotalWithMarkup(75000, "margin_on_price", 25);
    expect(r.clientTotal).toBe(100000);
    expect(r.markupAmount).toBe(25000);
  });

  it("none leaves total equal to materials", () => {
    const r = computeClientTotalWithMarkup(1234.56, "none", 99);
    expect(r.clientTotal).toBe(1234.56);
    expect(r.markupAmount).toBe(0);
  });
});
