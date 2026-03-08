// src/lib/email/index.ts
// Email delivery via Resend
// All email sending logic lives here

import { Resend } from "resend";

const resend = new Resend(process.env["RESEND_API_KEY"]);
const FROM = process.env["EMAIL_FROM"] ?? "North Star <hello@northstar.app>";
const APP_NAME = process.env["NEXT_PUBLIC_APP_NAME"] ?? "North Star";
const APP_URL = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";

interface InvitationEmailParams {
  to: string;
  senderName: string;
  inviteUrl: string;
}

interface PasswordResetEmailParams {
  to: string;
  resetUrl: string;
}

interface WelcomeEmailParams {
  to: string;
  name: string;
}

function emailHtmlWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#F7F3EE;font-family:'Georgia',serif;">
  <div style="max-width:560px;margin:40px auto;background:#FAF7F3;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(26,23,20,0.08);">
    <!-- Header -->
    <div style="background:#1A1714;padding:28px 36px;text-align:center;">
      <div style="font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(232,201,122,0.6);margin-bottom:8px;">⭐ NORTH STAR</div>
      <div style="font-size:22px;color:white;font-weight:600;">Goal Tracker</div>
    </div>
    <!-- Content -->
    <div style="padding:36px;color:#1A1714;">
      ${content}
    </div>
    <!-- Footer -->
    <div style="padding:20px 36px;border-top:1px solid #EDE7DE;text-align:center;">
      <p style="font-size:11px;color:#8C857D;margin:0;">© ${new Date().getFullYear()} ${APP_NAME} · <a href="${APP_URL}" style="color:#C4963A;text-decoration:none;">${APP_URL}</a></p>
    </div>
  </div>
</body>
</html>`;
}

export const emailService = {
  async sendInvitation({ to, senderName, inviteUrl }: InvitationEmailParams) {
    const content = `
      <h2 style="font-size:24px;font-weight:600;color:#1A1714;margin:0 0 12px;">You've been invited 🌟</h2>
      <p style="font-size:15px;color:#3D3732;line-height:1.7;margin:0 0 24px;">
        <strong>${senderName}</strong> has invited you to join them on <strong>${APP_NAME}</strong> — a goal tracker for people who are serious about what they want.
      </p>
      <div style="background:#F7F3EE;border-radius:12px;padding:20px;margin:0 0 28px;">
        <p style="font-size:13px;color:#8C857D;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.08em;">Your invitation link</p>
        <p style="font-size:13px;word-break:break-all;margin:0;color:#1A1714;font-family:monospace;">${inviteUrl}</p>
      </div>
      <a href="${inviteUrl}" style="display:inline-block;background:#1A1714;color:#F7F3EE;text-decoration:none;padding:14px 28px;border-radius:100px;font-size:14px;font-weight:600;">
        Accept Invitation →
      </a>
      <p style="font-size:12px;color:#8C857D;margin:24px 0 0;">This link expires in 7 days.</p>
    `;

    await resend.emails.send({
      from: FROM,
      to,
      subject: `${senderName} invited you to North Star`,
      html: emailHtmlWrapper(content),
    });
  },

  async sendPasswordReset({ to, resetUrl }: PasswordResetEmailParams) {
    const content = `
      <h2 style="font-size:24px;font-weight:600;color:#1A1714;margin:0 0 12px;">Reset your password</h2>
      <p style="font-size:15px;color:#3D3732;line-height:1.7;margin:0 0 24px;">
        We received a request to reset your ${APP_NAME} password. Click the button below to choose a new one.
      </p>
      <a href="${resetUrl}" style="display:inline-block;background:#1A1714;color:#F7F3EE;text-decoration:none;padding:14px 28px;border-radius:100px;font-size:14px;font-weight:600;">
        Reset Password →
      </a>
      <p style="font-size:12px;color:#8C857D;margin:24px 0 0;">
        This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
      </p>
    `;

    await resend.emails.send({
      from: FROM,
      to,
      subject: `Reset your ${APP_NAME} password`,
      html: emailHtmlWrapper(content),
    });
  },

  async sendWelcome({ to, name }: WelcomeEmailParams) {
    const firstName = name.split(" ")[0] ?? name;
    const content = `
      <h2 style="font-size:24px;font-weight:600;color:#1A1714;margin:0 0 12px;">Welcome to ${APP_NAME}, ${firstName} ⭐</h2>
      <p style="font-size:15px;color:#3D3732;line-height:1.7;margin:0 0 24px;">
        You've just planted your first star. Every extraordinary journey begins with a single decision to begin.
      </p>
      <p style="font-size:15px;color:#3D3732;line-height:1.7;margin:0 0 28px;">
        Here's how to get started:
      </p>
      <div style="margin:0 0 16px;">
        <div style="display:flex;gap:12px;margin-bottom:12px;">
          <span style="font-size:20px;">🎯</span>
          <div>
            <strong style="font-size:14px;">Create your first goal</strong>
            <p style="font-size:13px;color:#8C857D;margin:4px 0 0;">Choose a category, set a target, and write your why.</p>
          </div>
        </div>
        <div style="display:flex;gap:12px;margin-bottom:12px;">
          <span style="font-size:20px;">📅</span>
          <div>
            <strong style="font-size:14px;">Log your first day</strong>
            <p style="font-size:13px;color:#8C857D;margin:4px 0 0;">Track your mood, sleep, and today's intentions.</p>
          </div>
        </div>
        <div style="display:flex;gap:12px;">
          <span style="font-size:20px;">👥</span>
          <div>
            <strong style="font-size:14px;">Invite your circle</strong>
            <p style="font-size:13px;color:#8C857D;margin:4px 0 0;">Accountability multiplies results.</p>
          </div>
        </div>
      </div>
      <a href="${APP_URL}/dashboard" style="display:inline-block;background:#1A1714;color:#F7F3EE;text-decoration:none;padding:14px 28px;border-radius:100px;font-size:14px;font-weight:600;margin-top:16px;">
        Start tracking →
      </a>
    `;

    await resend.emails.send({
      from: FROM,
      to,
      subject: `Welcome to ${APP_NAME} ⭐`,
      html: emailHtmlWrapper(content),
    });
  },
};
