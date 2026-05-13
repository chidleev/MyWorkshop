import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import pdfMake from "pdfmake";
import { dbPool } from "../config/db";
import { documentsPath } from "../config/paths";

const pdfmakeRequire = createRequire(__filename);

const COMPANY = "ООО «Моя Мастерская»";

export interface ClosingOrderLine {
  article: string;
  name: string;
  required_quantity: string;
  sale_price: string;
  line_total: string;
}

export interface ClosingOrderContext {
  orderId: number;
  agreementLabel: string;
  totalCost: string;
  /** Сумма позиций по складским ценам (без договорной наценки), совпадает с Σ строк спецификации. */
  materialsSubtotal: string;
  createdAt: string;
  issuedAt: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  clientAddress: string | null;
  lines: ClosingOrderLine[];
}

let pdfFontsConfigured = false;

function resolvePdfMakeRobotoDir(): string {
  const pkgJson = pdfmakeRequire.resolve("pdfmake/package.json");
  return path.join(path.dirname(pkgJson), "fonts", "Roboto");
}

function configurePdfMake(): void {
  if (pdfFontsConfigured) {
    return;
  }
  const dir = resolvePdfMakeRobotoDir();
  pdfMake.setFonts({
    Roboto: {
      normal: path.join(dir, "Roboto-Regular.ttf"),
      bold: path.join(dir, "Roboto-Medium.ttf"),
      italics: path.join(dir, "Roboto-Italic.ttf"),
      bolditalics: path.join(dir, "Roboto-MediumItalic.ttf")
    }
  });
  const allowedRoot = path.resolve(dir);
  pdfMake.setLocalAccessPolicy((filePath) => path.resolve(filePath).startsWith(allowedRoot));
  pdfMake.setUrlAccessPolicy(() => false);
  pdfFontsConfigured = true;
}

function formatMoneyRu(raw: string): string {
  const n = Number(String(raw).replace(",", "."));
  if (Number.isFinite(n)) {
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(n);
  }
  return raw;
}

function parseMoneyDecimal(raw: string): number {
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function formatQtyRu(raw: string): string {
  const n = Number(String(raw).replace(",", "."));
  if (Number.isFinite(n)) {
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3
    }).format(n);
  }
  return raw;
}

export async function loadClosingOrderContext(orderId: number): Promise<ClosingOrderContext | null> {
  const [orderRows] = await dbPool.query(
    `SELECT
        o.id AS order_id,
        o.agreement_number,
        o.total_cost,
        o.created_at,
        c.full_name AS client_name,
        c.phone AS client_phone,
        c.email AS client_email,
        c.address AS client_address,
        (
          SELECT COALESCE(SUM(si2.sale_price), 0)
          FROM specification_items si2
          WHERE si2.order_id = o.id
        ) AS materials_subtotal
     FROM orders o
     JOIN clients c ON c.id = o.client_id
     WHERE o.id = ?
     LIMIT 1`,
    [orderId]
  );
  const head = (orderRows as Array<Record<string, unknown>>)[0];
  if (!head) {
    return null;
  }

  const [lineRows] = await dbPool.query(
    `SELECT
        m.article,
        m.name,
        si.required_quantity,
        m.base_cost AS sale_price,
        ROUND(si.sale_price, 2) AS line_total
     FROM specification_items si
     JOIN materials m ON m.id = si.material_id
     WHERE si.order_id = ?
     ORDER BY m.name ASC`,
    [orderId]
  );

  const lines = (lineRows as ClosingOrderLine[]).map((row) => ({
    article: String(row.article ?? ""),
    name: String(row.name ?? ""),
    required_quantity: String(row.required_quantity ?? "0"),
    sale_price: String(row.sale_price ?? "0"),
    line_total: String(row.line_total ?? "0")
  }));

  const issued = new Date();
  const agreementLabel = head.agreement_number != null ? String(head.agreement_number) : String(orderId);

  return {
    orderId,
    agreementLabel,
    totalCost: String(head.total_cost ?? "0"),
    materialsSubtotal: String(head.materials_subtotal ?? "0"),
    createdAt: formatDateRu(head.created_at),
    issuedAt: formatDateRu(issued),
    clientName: String(head.client_name ?? ""),
    clientPhone: head.client_phone != null ? String(head.client_phone) : null,
    clientEmail: head.client_email != null ? String(head.client_email) : null,
    clientAddress: head.client_address != null ? String(head.client_address) : null,
    lines
  };
}

function formatDateRu(value: unknown): string {
  if (value instanceof Date) {
    return value.toLocaleString("ru-RU", { dateStyle: "long", timeStyle: "short" });
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("ru-RU", { dateStyle: "long", timeStyle: "short" });
    }
  }
  return String(value ?? "");
}

function receiptTotalsStack(ctx: ClosingOrderContext): Record<string, unknown>[] {
  const total = parseMoneyDecimal(ctx.totalCost);
  const materials = parseMoneyDecimal(ctx.materialsSubtotal);
  const diff = Number((total - materials).toFixed(2));
  const stack: Record<string, unknown>[] = [];
  if (Math.abs(diff) < 0.01) {
    stack.push({
      text: [
        { text: "Итого к оплате: ", bold: true },
        { text: `${formatMoneyRu(ctx.totalCost)} ₽`, bold: true, fontSize: 12 }
      ],
      alignment: "right"
    });
    return stack;
  }
  stack.push({
    text: [
      { text: "Сумма по позициям: ", bold: true },
      { text: `${formatMoneyRu(ctx.materialsSubtotal)} ₽`, bold: true }
    ],
    alignment: "right",
    margin: [0, 0, 0, 2]
  });
  const adjLabel = diff > 0 ? "Наценка по договору: " : "Скидка по договору: ";
  const adjValue = formatMoneyRu(String(Math.abs(diff)));
  stack.push({
    text: [{ text: adjLabel, bold: true }, { text: `${adjValue} ₽`, bold: true }],
    alignment: "right",
    margin: [0, 0, 0, 2]
  });
  stack.push({
    text: [
      { text: "Итого к оплате: ", bold: true },
      { text: `${formatMoneyRu(ctx.totalCost)} ₽`, bold: true, fontSize: 12 }
    ],
    alignment: "right",
    margin: [0, 8, 0, 0]
  });
  return stack;
}

function receiptDocDefinition(ctx: ClosingOrderContext): Record<string, unknown> {
  const tableBody: unknown[][] = [
    [
      { text: "№", style: "th", alignment: "center" },
      { text: "Артикул", style: "th" },
      { text: "Наименование", style: "th" },
      { text: "Кол-во", style: "th", alignment: "right" },
      { text: "Цена, ₽", style: "th", alignment: "right" },
      { text: "Сумма, ₽", style: "th", alignment: "right" }
    ]
  ];

  ctx.lines.forEach((line, i) => {
    tableBody.push([
      { text: String(i + 1), alignment: "center" },
      { text: line.article },
      { text: line.name },
      { text: formatQtyRu(line.required_quantity), alignment: "right" },
      { text: formatMoneyRu(line.sale_price), alignment: "right" },
      { text: formatMoneyRu(line.line_total), alignment: "right" }
    ]);
  });

  if (ctx.lines.length === 0) {
    tableBody.push([
      { text: "Нет позиций в спецификации", colSpan: 6, alignment: "center", italics: true },
      {},
      {},
      {},
      {},
      {}
    ]);
  }

  return {
    info: {
      title: `Чек заказа ${ctx.agreementLabel}`,
      author: COMPANY
    },
    pageMargins: [48, 48, 48, 56],
    defaultStyle: { font: "Roboto", fontSize: 10, color: "#222222" },
    styles: {
      th: { bold: true, fillColor: "#eae8e1", margin: [0, 4, 0, 4] },
      title: { fontSize: 16, bold: true, color: "#1a1a2e" },
      muted: { fontSize: 9, color: "#555555" }
    },
    content: [
      { text: COMPANY, style: "muted" },
      { text: "Товарный чек (закрывающий документ)", style: "title", margin: [0, 6, 0, 16] },
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "Заказчик", bold: true, margin: [0, 0, 0, 4] },
              { text: ctx.clientName },
              ...(ctx.clientPhone ? [{ text: `Тел.: ${ctx.clientPhone}` }] : []),
              ...(ctx.clientEmail ? [{ text: `E-mail: ${ctx.clientEmail}` }] : []),
              ...(ctx.clientAddress ? [{ text: `Адрес: ${ctx.clientAddress}` }] : [])
            ]
          },
          {
            width: 200,
            stack: [
              { text: "Документ", bold: true },
              { text: `№ ${ctx.agreementLabel}` },
              { text: `Дата выдачи: ${ctx.issuedAt}`, margin: [0, 6, 0, 0] },
              { text: `Заказ в системе: #${ctx.orderId}`, style: "muted", margin: [0, 4, 0, 0] }
            ]
          }
        ],
        margin: [0, 0, 0, 16]
      },
      {
        table: {
          headerRows: 1,
          widths: [26, 70, "*", 52, 62, 62],
          dontBreakRows: true,
          body: tableBody
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#cccccc",
          vLineColor: () => "#cccccc",
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 4,
          paddingBottom: () => 4
        },
        margin: [0, 0, 0, 12]
      },
      {
        columns: [
          { width: "*", text: "" },
          {
            width: 220,
            stack: receiptTotalsStack(ctx)
          }
        ]
      },
      {
        text: "Документ сформирован автоматически в информационной системе «Моя Мастерская» при переводе заказа в статус «Завершён».",
        style: "muted",
        margin: [0, 24, 0, 0]
      }
    ]
  };
}

function actDocDefinition(ctx: ClosingOrderContext): Record<string, unknown> {
  const sumWords = `${formatMoneyRu(ctx.totalCost)} ₽`;
  return {
    info: {
      title: `Акт заказа ${ctx.agreementLabel}`,
      author: COMPANY
    },
    pageMargins: [48, 48, 48, 56],
    defaultStyle: { font: "Roboto", fontSize: 10, color: "#222222" },
    styles: {
      title: { fontSize: 15, bold: true, alignment: "center", color: "#1a1a2e" },
      h2: { fontSize: 11, bold: true, margin: [0, 14, 0, 6] },
      p: { alignment: "justify", lineHeight: 1.35 },
      muted: { fontSize: 9, color: "#555555" },
      sign: { margin: [0, 28, 0, 4] }
    },
    content: [
      { text: COMPANY, style: "muted" },
      {
        text: "Акт сдачи-приёмки выполненных работ\n(изготовление мебели по индивидуальному заказу)",
        style: "title",
        margin: [0, 10, 0, 20]
      },
      {
        text: [
          { text: "г. _______________", italics: true },
          { text: `     ${ctx.issuedAt}`, bold: true }
        ],
        margin: [0, 0, 0, 12]
      },
      {
        text: `${COMPANY}, именуемое в дальнейшем «Исполнитель», в лице уполномоченного представителя, с одной стороны, и `,
        style: "p"
      },
      {
        text: `${ctx.clientName}, именуемый(ая) в дальнейшем «Заказчик», с другой стороны, составили настоящий акт о нижеследующем.`,
        style: "p",
        margin: [0, 6, 0, 0]
      },
      { text: "1. Предмет договора", style: "h2" },
      {
        text: `Исполнитель выполнил, а Заказчик принял работы по договору (заказу) № ${ctx.agreementLabel} от ${ctx.createdAt} на изготовление и поставку мебели по согласованной спецификации.`,
        style: "p"
      },
      { text: "2. Стоимость и расчёты", style: "h2" },
      {
        text: `Общая стоимость выполненных работ составляет ${sumWords} (включая материалы и работы по спецификации). Заказчик претензий по объёму, качеству и срокам выполнения работ на момент подписания акта не имеет.`,
        style: "p"
      },
      { text: "3. Заключительные положения", style: "h2" },
      {
        text: "Настоящий акт составлен в двух экземплярах, имеющих равную юридическую силу, по одному для каждой из сторон. Подписи сторон могут быть проставлены на бумажной копии при необходимости.",
        style: "p"
      },
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "Исполнитель", bold: true, style: "sign" },
              { text: COMPANY },
              { text: "________________ / ________________", margin: [0, 28, 0, 0] }
            ]
          },
          {
            width: "*",
            stack: [
              { text: "Заказчик", bold: true, style: "sign" },
              { text: ctx.clientName },
              { text: "________________ / ________________", margin: [0, 28, 0, 0] }
            ]
          }
        ],
        margin: [0, 8, 0, 0]
      },
      {
        text: `Электронный акт № ${ctx.agreementLabel} (заказ #${ctx.orderId})`,
        style: "muted",
        margin: [0, 24, 0, 0]
      }
    ]
  };
}

export async function writeClosingDocumentsToDisk(ctx: ClosingOrderContext): Promise<{
  receiptFile: string;
  actFile: string;
}> {
  configurePdfMake();
  const receiptName = `receipt_${ctx.orderId}.pdf`;
  const actName = `act_${ctx.orderId}.pdf`;
  const receiptFile = path.join(documentsPath, receiptName);
  const actFile = path.join(documentsPath, actName);

  const receiptPdf = pdfMake.createPdf(receiptDocDefinition(ctx));
  await receiptPdf.write(receiptFile);

  const actPdf = pdfMake.createPdf(actDocDefinition(ctx));
  await actPdf.write(actFile);

  return { receiptFile, actFile };
}

/** Для тестов: генерация в произвольную папку без обращения к БД. */
export async function writeClosingDocumentsForContext(
  ctx: ClosingOrderContext,
  targetDir: string
): Promise<{ receiptFile: string; actFile: string }> {
  configurePdfMake();
  const receiptFile = path.join(targetDir, `receipt_${ctx.orderId}.pdf`);
  const actFile = path.join(targetDir, `act_${ctx.orderId}.pdf`);
  await pdfMake.createPdf(receiptDocDefinition(ctx)).write(receiptFile);
  await pdfMake.createPdf(actDocDefinition(ctx)).write(actFile);
  return { receiptFile, actFile };
}
