import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../utils/logger';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

export class EmailService {
  private async send(options: { to: string; subject: string; html: string }) {
    try {
      await transporter.sendMail({ from: config.smtp.from, ...options });
    } catch (err) {
      logger.error({ err, to: options.to, subject: options.subject }, 'Failed to send email');
      throw err;
    }
  }

  async sendPasswordReset(to: string, name: string, resetToken: string) {
    const resetUrl = `${config.frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
    const safeName = escapeHtml(name);

    await this.send({
      to,
      subject: 'Đặt lại mật khẩu - Nền tảng cuộc thi',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <h2>Đặt lại mật khẩu</h2>
          <p>Xin chào ${safeName},</p>
          <p>Bạn đã yêu cầu đặt lại mật khẩu. Hãy bấm nút bên dưới để tiếp tục:</p>
          <a href="${resetUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Đặt lại mật khẩu
          </a>
          <p>Liên kết này sẽ hết hạn sau 1 giờ.</p>
          <p>Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email này.</p>
        </div>
      `,
    });
  }

  async sendVerification(to: string, name: string, verifyToken: string) {
    const verifyUrl = `${config.frontendUrl}/verify-email?token=${encodeURIComponent(verifyToken)}`;
    const safeName = escapeHtml(name);

    await this.send({
      to,
      subject: 'Xác minh địa chỉ email - CompeteHub',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <h2>Xác minh địa chỉ email</h2>
          <p>Xin chào ${safeName},</p>
          <p>Cảm ơn bạn đã đăng ký CompeteHub. Vui lòng bấm nút bên dưới để xác minh email của bạn:</p>
          <a href="${verifyUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Xác minh email
          </a>
          <p>Liên kết này sẽ hết hạn sau 24 giờ.</p>
          <p>Nếu bạn không đăng ký tài khoản này, hãy bỏ qua email này.</p>
        </div>
      `,
    });
  }

  async sendNotification(to: string, subject: string, message: string) {
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);

    await this.send({
      to,
      subject: `${subject} - Nền tảng cuộc thi`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <h2>${safeSubject}</h2>
          <p>${safeMessage}</p>
          <a href="${config.frontendUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Xem trên nền tảng
          </a>
        </div>
      `,
    });
  }
}
