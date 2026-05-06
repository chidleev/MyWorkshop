import { dbPool } from "../config/db";
import { getMailTransporter } from "../config/mail";

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

    const subject = `Ваш заказ ${data.agreement_number ?? orderId} успешно завершен!`;
    const html = `<p>Здравствуйте, ${data.full_name}!</p><p>Спасибо за заказ.</p><p>Чек: ${links.receiptLink}</p><p>Акт: ${links.actLink}</p>`;

    const transporter = getMailTransporter();
    if (!transporter) {
      console.log("SMTP is not configured. Mock email:");
      console.log({ to: data.email, subject, html });
      return;
    }

    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM ?? "no-reply@myworkshop.local",
        to: data.email,
        subject,
        html
      });
    } catch (error) {
      console.error("SMTP send error:", error);
    }
  }
}
