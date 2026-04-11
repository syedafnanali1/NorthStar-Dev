import { Resend } from "resend";

const resend = new Resend(process.env["RESEND_API_KEY"]);
const APP_NAME = process.env["NEXT_PUBLIC_APP_NAME"] ?? "NorthStar";
const APP_URL = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
const FROM = process.env["EMAIL_FROM"] ?? "North Star <hello@northstar.app>";

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function layoutHtml(content: string): string {
  return `
  <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111827;background:#f8fafc;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:28px;">
      <h1 style="margin:0 0 12px;font-size:20px;color:#111827;">${APP_NAME}</h1>
      ${content}
      <p style="margin-top:24px;font-size:12px;color:#6b7280;">
        If you did not request this, you can ignore this email.
      </p>
    </div>
  </div>`;
}

async function sendWithRetry(payload: EmailPayload): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await resend.emails.send({
        from: FROM,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
      console.info("[auth-email] sent", {
        to: payload.to,
        subject: payload.subject,
        status: "sent",
        attempt,
      });
      return;
    } catch (error) {
      lastError = error;
      console.error("[auth-email] send_failed", {
        to: payload.to,
        subject: payload.subject,
        status: "failed",
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });

      if (attempt < 3) {
        await wait(400 * 2 ** (attempt - 1));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Email send failed");
}

export const authEmailService = {
  async sendEmailVerificationOtp(input: {
    to: string;
    otp: string;
    verifyUrl: string;
  }): Promise<void> {
    const subject = `Verify your email - ${APP_NAME}`;
    const html = layoutHtml(`
      <h2 style="margin:0 0 12px;font-size:22px;color:#111827;">Verify your email</h2>
      <p style="margin:0 0 14px;color:#374151;">Use this 6-digit code to verify your account:</p>
      <p style="margin:0 0 18px;font-size:32px;letter-spacing:6px;font-weight:700;color:#111827;">${input.otp}</p>
      <p style="margin:0 0 20px;color:#374151;">This code expires in 10 minutes.</p>
      <a href="${input.verifyUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;">
        Verify Email
      </a>
    `);
    const text = [
      `Verify your email - ${APP_NAME}`,
      "",
      `Your verification code is: ${input.otp}`,
      "This code expires in 10 minutes.",
      "",
      `Verify now: ${input.verifyUrl}`,
    ].join("\n");

    await sendWithRetry({
      to: input.to,
      subject,
      html,
      text,
    });
  },

  async sendSignInStepUpOtp(input: {
    to: string;
    otp: string;
    verifyUrl: string;
    device: string;
    location: string;
    timestamp: string;
  }): Promise<void> {
    const subject = "New sign-in attempt - confirm it's you";
    const html = layoutHtml(`
      <h2 style="margin:0 0 12px;font-size:22px;color:#111827;">New sign-in attempt</h2>
      <p style="margin:0 0 14px;color:#374151;">Enter this code to finish signing in:</p>
      <p style="margin:0 0 18px;font-size:32px;letter-spacing:6px;font-weight:700;color:#111827;">${input.otp}</p>
      <ul style="margin:0 0 20px;padding-left:18px;color:#374151;">
        <li>Device: ${input.device}</li>
        <li>Location: ${input.location}</li>
        <li>Time: ${input.timestamp}</li>
      </ul>
      <a href="${input.verifyUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;">
        Confirm Sign-In
      </a>
    `);
    const text = [
      "New sign-in attempt - confirm it's you",
      "",
      `Code: ${input.otp}`,
      `Device: ${input.device}`,
      `Location: ${input.location}`,
      `Time: ${input.timestamp}`,
      "This code expires in 10 minutes and can only be used once.",
      "",
      `Confirm sign-in: ${input.verifyUrl}`,
    ].join("\n");

    await sendWithRetry({ to: input.to, subject, html, text });
  },

  async sendAccountLockedAlert(input: {
    to: string;
    lockMinutes: number;
  }): Promise<void> {
    const subject = `Security alert - account temporarily locked (${APP_NAME})`;
    const html = layoutHtml(`
      <h2 style="margin:0 0 12px;font-size:22px;color:#111827;">Security alert</h2>
      <p style="margin:0 0 14px;color:#374151;">
        We detected multiple failed login attempts and temporarily locked your account.
      </p>
      <p style="margin:0 0 8px;color:#374151;">Lock duration: ${input.lockMinutes} minutes.</p>
      <p style="margin:0;color:#374151;">If this wasn't you, reset your password immediately.</p>
    `);
    const text = [
      "Security alert",
      "",
      "We detected multiple failed login attempts and temporarily locked your account.",
      `Lock duration: ${input.lockMinutes} minutes.`,
      "If this wasn't you, reset your password immediately.",
      "",
      `${APP_URL}/auth/forgot-password`,
    ].join("\n");

    await sendWithRetry({ to: input.to, subject, html, text });
  },

  async sendPasswordChangedNotice(input: { to: string }): Promise<void> {
    const subject = `Password changed - ${APP_NAME}`;
    const html = layoutHtml(`
      <h2 style="margin:0 0 12px;font-size:22px;color:#111827;">Password updated</h2>
      <p style="margin:0 0 14px;color:#374151;">
        Your password was changed successfully. All active sessions were signed out.
      </p>
      <p style="margin:0;color:#374151;">
        If this was not you, reset your password immediately and review your account security settings.
      </p>
    `);
    const text = [
      "Password updated",
      "",
      "Your password was changed successfully. All active sessions were signed out.",
      "If this was not you, reset your password immediately.",
      "",
      `${APP_URL}/auth/forgot-password`,
    ].join("\n");

    await sendWithRetry({ to: input.to, subject, html, text });
  },
};
