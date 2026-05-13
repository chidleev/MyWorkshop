/** HTML + plain text for transactional emails (table layout, inline styles). */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolvePublicOrigin(): string {
  const fromCsv = process.env.FRONTEND_URLS?.split(",")[0]?.trim();
  const single = process.env.FRONTEND_URL?.trim();
  const raw = fromCsv || single || "";
  if (!raw) {
    return "";
  }
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

export function absoluteUrl(pathOrUrl: string): string {
  const trimmed = pathOrUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const origin = resolvePublicOrigin();
  if (!origin) {
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${origin.replace(/\/+$/, "")}${path}`;
}

const BRAND_NAME = "ООО «Моя Мастерская»";
const PREHEADER_SPACER =
  "&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;";

function emailShell(preheader: string, inner: string): string {
  const safePre = escapeHtml(preheader);
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${safePre}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#e8e6e1;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<span style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#e8e6e1;max-height:0;max-width:0;opacity:0;overflow:hidden;">
${safePre}${PREHEADER_SPACER}
</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#e8e6e1;">
<tr>
<td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(26,26,46,0.08);">
${inner}
</table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
<tr>
<td style="padding:24px 8px 8px;font-family:Georgia,'Times New Roman',serif;font-size:12px;line-height:1.5;color:#6b6b76;text-align:center;">
${escapeHtml(BRAND_NAME)}
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

function headerBlock(title: string, subtitle?: string): string {
  const t = escapeHtml(title);
  const sub = subtitle ? `<p style="margin:12px 0 0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:15px;line-height:1.5;color:rgba(255,255,255,0.88);">${escapeHtml(subtitle)}</p>` : "";
  return `<tr>
<td style="background-color:#1a1a2e;padding:36px 32px 32px;text-align:left;">
<p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#c9a227;">${escapeHtml(BRAND_NAME)}</p>
<h1 style="margin:10px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;font-weight:600;color:#ffffff;">${t}</h1>
${sub}
</td>
</tr>`;
}

function contentBlock(html: string): string {
  return `<tr>
<td style="padding:32px 32px 36px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:16px;line-height:1.65;color:#2d2d35;">
${html}
</td>
</tr>`;
}

function bulletproofButton(href: string, label: string, bg: string): string {
  const h = escapeHtml(href);
  const l = escapeHtml(label);
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 12px;">
<tr>
<td style="border-radius:8px;background-color:${bg};">
<a href="${h}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${l}</a>
</td>
</tr>
</table>`;
}

function subtleNote(html: string): string {
  return `<p style="margin:20px 0 0;padding:14px 16px;background-color:#f4f2ed;border-radius:8px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:13px;line-height:1.55;color:#5c5c66;border-left:3px solid #c9a227;">${html}</p>`;
}

export interface OrderCompletedEmailInput {
  fullName: string;
  agreementLabel: string;
  orderId: number;
  totalCost: string;
  receiptPath: string;
  actPath: string;
}

export function buildOrderCompletedEmail(input: OrderCompletedEmailInput): { html: string; text: string } {
  const name = escapeHtml(input.fullName);
  const ref = escapeHtml(input.agreementLabel);
  const total = escapeHtml(input.totalCost);
  const receiptHref = absoluteUrl(input.receiptPath);
  const actHref = absoluteUrl(input.actPath);

  const inner =
    headerBlock("Заказ выполнен", "Документы готовы к скачиванию") +
    contentBlock(`
<p style="margin:0 0 16px;">Здравствуйте, ${name}!</p>
<p style="margin:0 0 20px;">Благодарим вас за доверие. Заказ <strong>${ref}</strong> успешно завершён. Итоговая сумма по договору: <strong>${total}</strong> ₽.</p>
<p style="margin:0 0 12px;font-size:14px;color:#5c5c66;">Ниже — ссылки на чек и акт выполненных работ (сохраните файлы при необходимости).</p>
${bulletproofButton(receiptHref, "Скачать чек", "#2c5282")}
${bulletproofButton(actHref, "Скачать акт", "#1a1a2e")}
${subtleNote(`Если кнопки не открываются, скопируйте ссылку в браузер:<br/>
<span style="word-break:break-all;">Чек: ${escapeHtml(receiptHref)}</span><br/>
<span style="word-break:break-all;">Акт: ${escapeHtml(actHref)}</span>`)}
<p style="margin:28px 0 0;font-size:14px;color:#6b6b76;">С уважением,<br/>команда ${escapeHtml(BRAND_NAME)}</p>
`);

  const text = [
    `Здравствуйте, ${input.fullName}!`,
    "",
    `Заказ ${input.agreementLabel} завершён. Сумма: ${input.totalCost} ₽.`,
    "",
    `Чек: ${receiptHref}`,
    `Акт: ${actHref}`,
    "",
    BRAND_NAME
  ].join("\n");

  return { html: emailShell(`Заказ ${input.agreementLabel} завершён`, inner), text };
}

export interface WebApplicationRejectedEmailInput {
  clientName: string;
  applicationRef: string;
}

export function buildWebApplicationRejectedEmail(
  input: WebApplicationRejectedEmailInput
): { html: string; text: string } {
  const name = escapeHtml(input.clientName);
  const ref = escapeHtml(input.applicationRef);

  const inner =
    headerBlock("Заявка не принята в работу") +
    contentBlock(`
<p style="margin:0 0 16px;">Здравствуйте, ${name}!</p>
<p style="margin:0 0 20px;">К сожалению, заявка <strong>${ref}</strong> не будет обработана в текущем виде. Это не помешает вам обратиться к нам снова — мы подскажем, как оформить запрос корректно.</p>
<p style="margin:0 0 8px;font-size:14px;color:#5c5c66;">Если нужны уточнения, напишите или позвоните нам удобным способом (контакты на сайте и в переписке с менеджером).</p>
${subtleNote("Мы ценим ваше время и готовы помочь с новой заявкой, когда это будет уместно.")}
<p style="margin:28px 0 0;font-size:14px;color:#6b6b76;">С уважением,<br/>${escapeHtml(BRAND_NAME)}</p>
`);

  const text = [
    `Здравствуйте, ${input.clientName}!`,
    "",
    `Заявка (${input.applicationRef}) не принята в работу.`,
    "При необходимости свяжитесь с нами удобным для вас способом.",
    "",
    BRAND_NAME
  ].join("\n");

  return { html: emailShell(`Заявка ${input.applicationRef} не принята`, inner), text };
}
