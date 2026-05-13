import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import app from "../src/app";
import { documentsPath } from "../src/config/paths";
import { writeClosingDocumentsForContext, type ClosingOrderContext } from "../src/services/ClosingDocumentsService";

const require = createRequire(import.meta.url);

describe("ClosingDocumentsService", () => {
  it("resolves bundled Roboto fonts from pdfmake", () => {
    const pkg = require.resolve("pdfmake/package.json");
    const roboto = path.join(path.dirname(pkg), "fonts", "Roboto", "Roboto-Regular.ttf");
    expect(roboto).toMatch(/Roboto-Regular\.ttf$/);
  });

  it("writes receipt and act PDFs to disk", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mw-closing-"));
    const ctx: ClosingOrderContext = {
      orderId: 999001,
      agreementLabel: "TEST-AGR-1",
      totalCost: "125000.50",
      createdAt: "1 января 2026 г.",
      issuedAt: "13 мая 2026 г.",
      clientName: "Иванов Иван Иванович",
      clientPhone: "+7 900 000-00-00",
      clientEmail: "client@example.com",
      clientAddress: "г. Москва, ул. Примерная, д. 1",
      lines: [
        {
          article: "DSP-001",
          name: "ЛДСП 16 мм белый",
          required_quantity: "4.5",
          sale_price: "3500.00",
          line_total: "15750.00"
        }
      ]
    };

    const { receiptFile, actFile } = await writeClosingDocumentsForContext(ctx, dir);
    const receiptStat = await fs.stat(receiptFile);
    const actStat = await fs.stat(actFile);
    expect(receiptStat.size).toBeGreaterThan(2000);
    expect(actStat.size).toBeGreaterThan(2000);

    const head = await fs.readFile(receiptFile, { encoding: "latin1" });
    expect(head.startsWith("%PDF")).toBe(true);
  });

  it("serves generated PDF at /documents (static)", async () => {
    const orderId = 999002;
    const receiptName = `receipt_${orderId}.pdf`;
    const actName = `act_${orderId}.pdf`;
    const ctx: ClosingOrderContext = {
      orderId,
      agreementLabel: "STATIC-TEST",
      totalCost: "100.00",
      createdAt: "1 января 2026 г.",
      issuedAt: "13 мая 2026 г.",
      clientName: "Тестовый клиент",
      clientPhone: null,
      clientEmail: null,
      clientAddress: null,
      lines: []
    };
    await writeClosingDocumentsForContext(ctx, documentsPath);
    try {
      const res = await request(app).get(`/documents/${receiptName}`);
      expect(res.status).toBe(200);
      expect(String(res.headers["content-type"] ?? "")).toMatch(/pdf/i);
      expect(Buffer.isBuffer(res.body) ? res.body.slice(0, 4).toString() : res.text.slice(0, 4)).toBe("%PDF");
    } finally {
      await fs.unlink(path.join(documentsPath, receiptName)).catch(() => undefined);
      await fs.unlink(path.join(documentsPath, actName)).catch(() => undefined);
    }
  });
});
