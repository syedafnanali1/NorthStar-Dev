// src/lib/sms/index.ts
// SMS delivery via Twilio
// Gracefully no-ops if Twilio credentials are not configured

interface SendInvitationParams {
  to: string;
  senderName: string;
  inviteUrl: string;
}

export const smsService = {
  async sendInvitation({ to, senderName, inviteUrl }: SendInvitationParams): Promise<void> {
    const sid = process.env["TWILIO_ACCOUNT_SID"];
    const token = process.env["TWILIO_AUTH_TOKEN"];
    const from = process.env["TWILIO_PHONE_NUMBER"];

    // Gracefully skip if Twilio is not configured
    if (!sid || !token || !from) {
      console.info(
        "SMS not sent: Twilio credentials not configured. " +
        "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to enable SMS."
      );
      return;
    }

    const appName = process.env["NEXT_PUBLIC_APP_NAME"] ?? "North Star";
    const message = `${senderName} invited you to ${appName} — a goal tracker for serious growth. Sign up here: ${inviteUrl}`;

    // Lazy-load Twilio to avoid issues when not installed
    try {
      const twilio = await import("twilio");
      const client = twilio.default(sid, token);
      await client.messages.create({ body: message, from, to });
    } catch (err) {
      console.error("Failed to send SMS:", err);
      // Don't throw — SMS failure shouldn't block the invitation flow
    }
  },
};
