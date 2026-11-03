import nodemailer from "nodemailer";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Email service for sending transactional emails
 * Uses SMTP configuration from environment variables
 */
class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    if (!process.env.SMTP_HOST || !process.env.SMTP_PORT) {
      console.warn("[Email] SMTP not configured. Email service will be disabled.");
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Send an email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      console.warn("[Email] Email service not configured. Skipping email send.");
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || "noreply@lycon.browser",
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      console.log("[Email] Email sent successfully to:", options.to);
      return true;
    } catch (error) {
      console.error("[Email] Failed to send email:", error);
      return false;
    }
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(email: string, token: string): Promise<boolean> {
    const verificationUrl = `${process.env.APP_URL || "http://localhost:3000"}/verify-email?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Verify Your Email Address</h2>
        <p>Thank you for signing up for Lycon Browser. Please verify your email address by clicking the button below:</p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">Verify Email</a>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
        <p style="color: #666; font-size: 12px;">This link will expire in 24 hours.</p>
        <p style="color: #666;">If you didn't create an account with Lycon Browser, you can safely ignore this email.</p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: "Verify Your Email Address - Lycon Browser",
      html,
      text: `Verify your email address: ${verificationUrl}`,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    const resetUrl = `${process.env.APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Reset Your Password</h2>
        <p>We received a request to reset your password for your Lycon Browser account. Click the button below to reset it:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 16px 0;">Reset Password</a>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <p style="color: #666; font-size: 12px;">This link will expire in 1 hour.</p>
        <p style="color: #666;">If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: "Reset Your Password - Lycon Browser",
      html,
      text: `Reset your password: ${resetUrl}`,
    });
  }

  /**
   * Send 2FA setup email (with backup codes)
   */
  async sendTwoFactorSetupEmail(email: string, backupCodes: string[]): Promise<boolean> {
    const codesList = backupCodes.map((code, i) => `${i + 1}. ${code}`).join("<br>");

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Two-Factor Authentication Enabled</h2>
        <p>Two-factor authentication has been enabled for your Lycon Browser account. Here are your backup codes:</p>
        <div style="background-color: #f5f5f5; padding: 16px; border-radius: 4px; margin: 16px 0;">
          ${codesList}
        </div>
        <p style="color: #666;"><strong>Important:</strong> Save these codes in a secure location. You can use each code only once.</p>
        <p style="color: #666;">If you didn't enable two-factor authentication, please contact support immediately.</p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: "Two-Factor Authentication Enabled - Lycon Browser",
      html,
      text: `Two-factor authentication enabled. Backup codes:\n${backupCodes.join("\n")}`,
    });
  }
}

export const emailService = new EmailService();
