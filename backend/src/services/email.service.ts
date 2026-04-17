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
      subject: 'Reset your password - Competition Platform',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <h2>Password Reset</h2>
          <p>Hi ${safeName},</p>
          <p>You requested a password reset. Click the button below to reset your password:</p>
          <a href="${resetUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Reset Password
          </a>
          <p>This link expires in 1 hour.</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
  }

  async sendNotification(to: string, subject: string, message: string) {
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);

    await this.send({
      to,
      subject: `${subject} - Competition Platform`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <h2>${safeSubject}</h2>
          <p>${safeMessage}</p>
          <a href="${config.frontendUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            View on Platform
          </a>
        </div>
      `,
    });
  }
}
