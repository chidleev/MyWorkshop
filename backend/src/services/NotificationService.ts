import { dbPool } from "../config/db";
import { getMailTransporter } from "../config/mail";
import { AppError } from "../utils/AppError";
import {
  buildOrderCompletedEmail,
  buildWebApplicationRejectedEmail
} from "../utils/transactionalEmailHtml";
import { loadClosingOrderContext, writeClosingDocumentsToDisk } from "./ClosingDocumentsService";

interface OrderClientInfo {
  order_id: number;
  agreement_number: string | null;
  total_cost: string;
  full_name: string;
  email: string | null;
}

export class NotificationService {
  static async generateDocuments(orderId: number): Promise<{ receiptLink: string; actLink: string }> {
    const receiptLink = `/documents/receipt_${orderId}.pdf`;
    const actLink = `/documents/act_${orderId}.pdf`;

    const context = await loadClosingOrderContext(orderId);
    if (!context) {
      throw new AppError(404, "Заказ не найден");
    }

    await writeClosingDocumentsToDisk(context);

    await dbPool.query(
      `DELETE FROM media_files WHERE order_id = ? AND secure_link IN (?, ?)`,
      [orderId, receiptLink, actLink]
    );
    await dbPool.query(
      "INSERT INTO media_files (order_id, file_type, secure_link) VALUES (?, 'Чек', ?), (?, 'Акт', ?)",
      [orderId, receiptLink, orderId, actLink]
    );

    return { receiptLink, actLink };
  }

  static async sendCompletionEmail(orderId: number, links: { receiptLink: string; actLink: string }): Promise<void> {
    const [rows] = await dbPool.query(
      `SELECT o.id as order_id, o.agreement_number, o.total_cost, c.full_name, c.email
       FROM orders o JOIN clients c ON c.id = o.client_id WHERE o.id = ?`,
      [orderId]
    );
    const data = (rows as OrderClientInfo[])[0];
    if (!data || !data.email) {
      console.log(`Email not sent for order ${orderId}: client email is empty`);
      return;
    }

    const agreementLabel = data.agreement_number ?? String(orderId);
    const subject = `Ваш заказ ${agreementLabel} успешно завершён`;
    const { html, text } = buildOrderCompletedEmail({
      fullName: data.full_name,
      agreementLabel,
      orderId,
      totalCost: data.total_cost,
      receiptPath: links.receiptLink,
      actPath: links.actLink
    });

    const transporter = getMailTransporter();
    if (!transporter) {
      console.log("SMTP is not configured. Mock email:");
      console.log({ to: data.email, subject, html, text });
      return;
    }

    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM ?? "no-reply@myworkshop.local",
        to: data.email,
        subject,
        html,
        text
      });
    } catch (error) {
      console.error("SMTP send error:", error);
    }
  }

  static async sendWebApplicationRejectedEmail(params: {
    toEmail: string | null;
    clientName: string;
    agreementNumber: string | null;
  }): Promise<void> {
    const { toEmail, clientName, agreementNumber } = params;
    if (!toEmail?.trim()) {
      console.log("Rejection email skipped: client email is empty");
      return;
    }

    const applicationRef = agreementNumber ?? "заявка";
    const subject = `Заявка ${applicationRef} не принята в работу`;
    const { html, text } = buildWebApplicationRejectedEmail({
      clientName,
      applicationRef
    });

    const transporter = getMailTransporter();
    if (!transporter) {
      console.log("SMTP is not configured. Mock rejection email:");
      console.log({ to: toEmail, subject, html, text });
      return;
    }

    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM ?? "no-reply@myworkshop.local",
        to: toEmail.trim(),
        subject,
        html,
        text
      });
    } catch (error) {
      console.error("SMTP send error (rejection):", error);
    }
  }
}
