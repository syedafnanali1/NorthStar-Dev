// SMS delivery via Twilio REST API (native fetch, Edge-compatible)
// Gracefully no-ops if Twilio credentials are not configured.

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

    if (!sid || !token || !from) {
      console.info(
        "SMS not sent: Twilio credentials not configured. " +
        "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to enable SMS."
      );
      return;
    }

    const appName = process.env["NEXT_PUBLIC_APP_NAME"] ?? "North Star";
    const body = `${senderName} invited you to ${appName} — a goal tracker for serious growth. Sign up here: ${inviteUrl}`;

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Twilio API ${response.status}: ${text}`);
      }
    } catch (err) {
      console.error("Failed to send SMS:", err);
      // Don't throw — SMS failure shouldn't block the invitation flow
    }
  },
};
