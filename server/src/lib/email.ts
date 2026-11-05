import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { prisma } from './prisma.js';

export interface SmtpConfigInput {
  host: string;
  port: number;
  secure: boolean;
  user?: string | null;
  pass?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
  isEnabled?: boolean;
}

/**
 * Retrieve SMTP configuration for a given parish.
 * Falls back to environment variables if not configured in DB.
 */
export async function getParishSmtpConfig(parishId: number): Promise<SmtpConfigInput | null> {
  const dbSetting = await prisma.smtpSetting.findUnique({
    where: { parishId },
  });

  if (dbSetting) {
    return {
      host: dbSetting.host,
      port: dbSetting.port,
      secure: dbSetting.secure,
      user: dbSetting.user,
      pass: dbSetting.pass,
      fromEmail: dbSetting.fromEmail || dbSetting.user,
      fromName: dbSetting.fromName || 'Parish Register',
      isEnabled: dbSetting.isEnabled,
    };
  }

  // Fallback to environment variables if present
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
      fromName: process.env.SMTP_FROM_NAME || 'Parish Register',
      isEnabled: true,
    };
  }

  return null;
}

/**
 * Creates a Nodemailer transporter instance for a given SMTP configuration.
 */
export function createTransporter(config: SmtpConfigInput): Transporter {
  let cleanPass = config.pass || '';
  // Google App Passwords are 16 letters, often displayed by Google with spaces (e.g. "abcd efgh ijkl mnop").
  // SMTP AUTH requires the spaces to be stripped.
  if ((config.host || '').includes('gmail.com')) {
    cleanPass = cleanPass.replace(/\s+/g, '');
  }

  return nodemailer.createTransport({
    host: config.host || 'smtp.gmail.com',
    port: config.port || 587,
    secure: config.secure ?? false,
    auth: {
      user: (config.user || '').trim(),
      pass: cleanPass,
    },
    // Gmail recommended timeout and TLS settings
    tls: {
      rejectUnauthorized: true,
    },
  });
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/**
 * Send an email from the active parish's configured SMTP settings.
 */
export async function sendParishEmail(parishId: number, options: SendEmailOptions) {
  const config = await getParishSmtpConfig(parishId);
  if (!config || !config.isEnabled) {
    console.warn(`[Email Service] SMTP is disabled or not configured for Parish ID ${parishId}. Email skipped.`);
    return {
      success: false,
      message: 'Email service is not enabled for this parish.',
      skipped: true,
    };
  }

  if (!config.user || !config.pass) {
    console.warn(`[Email Service] SMTP credentials missing for Parish ID ${parishId}.`);
    return {
      success: false,
      message: 'SMTP credentials missing.',
      skipped: true,
    };
  }

  const transporter = createTransporter(config);
  const senderAddress = config.fromName
    ? `"${config.fromName}" <${config.fromEmail || config.user}>`
    : config.fromEmail || config.user;

  try {
    const info = await transporter.sendMail({
      from: senderAddress,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      replyTo: options.replyTo,
    });

    console.log(`[Email Service] Email sent successfully to ${options.to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`[Email Service] Failed to send email to ${options.to}:`, error);
    return { success: false, error: error.message || 'Failed to send email.' };
  }
}

/**
 * Test SMTP connection by sending a diagnostic test message.
 */
export async function verifyAndTestSmtp(
  config: SmtpConfigInput,
  recipientEmail: string
): Promise<{ success: boolean; message: string; details?: any }> {
  if (!config.host || !config.port || !config.user || !config.pass) {
    return {
      success: false,
      message: 'Incomplete SMTP settings. Please provide Host, Port, Username and Password / App Password.',
    };
  }

  const transporter = createTransporter(config);

  try {
    // 1. Verify connection and credentials handshake with SMTP server
    await transporter.verify();

    // 2. Dispatch a test email
    const senderAddress = config.fromName
      ? `"${config.fromName}" <${config.fromEmail || config.user}>`
      : config.fromEmail || config.user;

    const testTime = new Date().toLocaleString();
    const result = await transporter.sendMail({
      from: senderAddress,
      to: recipientEmail,
      subject: `[Parish Register] SMTP Test Message (${testTime})`,
      text: `Hello,\n\nThis is a test email sent from the Parish Register System to confirm your SMTP configuration is active and working properly.\n\nHost: ${config.host}\nPort: ${config.port}\nSender: ${config.user}\nTimestamp: ${testTime}\n\nBlessings,\nParish Administration`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #1e293b; margin: 0 0 6px 0; font-size: 20px;">Parish Register System</h2>
            <span style="background-color: #ecfdf5; color: #047857; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 9999px; border: 1px solid #a7f3d0;">SMTP Handshake Successful</span>
          </div>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">Hello,</p>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            This email confirms that your outgoing mail server configuration has been verified successfully. Your parish can now reliably send password resets, automated notifications, and 2FA authentication codes.
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; color: #475569;">
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; font-weight: 600;">SMTP Host:</td>
              <td style="padding: 8px 0; font-family: monospace;">${config.host}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; font-weight: 600;">Port & Security:</td>
              <td style="padding: 8px 0; font-family: monospace;">${config.port} (${config.secure ? 'SSL/TLS' : 'STARTTLS'})</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; font-weight: 600;">Authenticated User:</td>
              <td style="padding: 8px 0; font-family: monospace;">${config.user}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Sent At:</td>
              <td style="padding: 8px 0; font-family: monospace;">${testTime}</td>
            </tr>
          </table>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
            Parish Register • Automated System Notification
          </p>
        </div>
      `,
    });

    return {
      success: true,
      message: `Test email successfully sent to ${recipientEmail}! Message ID: ${result.messageId}`,
      details: result,
    };
  } catch (err: any) {
    let friendlyError = err.message || 'SMTP authentication failed.';
    if (friendlyError.includes('535') || friendlyError.includes('BadCredentials') || friendlyError.includes('Username and Password not accepted')) {
      friendlyError = 'Google rejected the credentials (535 BadCredentials). Please check: 1) Verify that the App Password was generated under this exact Google account (check the profile avatar in the top right of your browser). 2) If using multiple accounts or a new device, visit https://accounts.google.com/DisplayUnlockCaptcha and click "Continue".';
    } else if (friendlyError.includes('ETIMEDOUT') || friendlyError.includes('ECONNREFUSED')) {
      friendlyError = `Connection to ${config.host}:${config.port} timed out or was refused. Check your firewall or port configuration.`;
    }

    return {
      success: false,
      message: friendlyError,
      details: err,
    };
  }
}

