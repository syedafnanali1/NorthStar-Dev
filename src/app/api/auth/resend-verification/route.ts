export const runtime = "edge";

import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { users } from "@/drizzle/schema";
import { appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { authEmailService } from "@/lib/email/auth";
import {
  AUTH_SECURITY_LIMITS,
  createOtpChallenge,
  maskEmail,
  normalizeEmail,
} from "@/lib/auth/security";
import { isEmailDeliveryConfigured } from "@/lib/env-checks";

const resendSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  mode: z.enum(["email", "signin"]).optional().default("email"),
});

function isResendTestingModeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /only send testing emails to your own email address/i.test(message);
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as unknown;
    const validated = resendSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          code: "VALIDATION_ERROR",
          message: "Valid email is required.",
        },
        { status: 422 }
      );
    }

    const email = normalizeEmail(validated.data.email);
    const purpose = validated.data.mode === "signin" ? "signin_step_up" : "email_verification";

    if (
      purpose === "email_verification" &&
      !isEmailDeliveryConfigured(process.env["RESEND_API_KEY"], process.env["EMAIL_FROM"])
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "EMAIL_DELIVERY_UNAVAILABLE",
          message:
            "Email delivery requires a verified custom domain in Resend. Visit resend.com/domains to set one up, then update EMAIL_FROM. Until then, use Google sign-in.",
        },
        { status: 503 }
      );
    }

    const [user] = await db
      .select({ id: users.id, emailVerified: users.emailVerified })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);

    if (!user) {
      return NextResponse.json({
        success: true,
        code: "RESENT_IF_EXISTS",
        message: "If this email exists, a new verification code has been sent.",
      });
    }

    if (purpose === "email_verification" && user.emailVerified) {
      return NextResponse.json({
        success: true,
        code: "ALREADY_VERIFIED",
        message: "This account is already verified.",
      });
    }

    const otpResult = await createOtpChallenge({
      userId: user.id,
      email,
      purpose,
      context: { flow: "resend" },
      force: false,
    });

    if (otpResult.status === "cooldown") {
      return NextResponse.json(
        {
          success: false,
          code: "OTP_COOLDOWN",
          message: `Please wait ${otpResult.waitSeconds}s before requesting a new code.`,
          data: {
            waitSeconds: otpResult.waitSeconds,
            resendAvailableAt: otpResult.resendAvailableAt.toISOString(),
          },
        },
        { status: 429 }
      );
    }

    const modeQuery = validated.data.mode === "signin" ? "signin" : "email";
    const verifyUrl = appUrl(
      `/auth/verify-email?email=${encodeURIComponent(email)}&code=${encodeURIComponent(otpResult.otp ?? "")}&mode=${modeQuery}`
    );

    try {
      if (purpose === "signin_step_up") {
        await authEmailService.sendSignInStepUpOtp({
          to: email,
          otp: otpResult.otp ?? "",
          verifyUrl,
          device: "Unknown device",
          location: "Unknown location",
          timestamp: new Date().toISOString(),
        });
      } else {
        await authEmailService.sendEmailVerificationOtp({
          to: email,
          otp: otpResult.otp ?? "",
          verifyUrl,
        });
      }
    } catch (emailError) {
      console.error("[POST /api/auth/resend-verification] send_failed", emailError);
      return NextResponse.json(
        {
          success: false,
          code: isResendTestingModeError(emailError)
            ? "EMAIL_DELIVERY_UNAVAILABLE"
            : "EMAIL_SEND_FAILED",
          message: isResendTestingModeError(emailError)
            ? "Email delivery requires a verified custom domain in Resend. Visit resend.com/domains to set one up, then update EMAIL_FROM. Until then, use Google sign-in."
            : "We couldn't send a verification email. Please check the address and try again.",
        },
        { status: isResendTestingModeError(emailError) ? 503 : 502 }
      );
    }

    return NextResponse.json({
      success: true,
      code: "OTP_SENT",
      message: "A new verification code has been sent.",
      data: {
        emailMasked: maskEmail(email),
        resendAfterSeconds: AUTH_SECURITY_LIMITS.otpResendCooldownSeconds,
      },
    });
  } catch (error) {
    console.error("[POST /api/auth/resend-verification]", error);
    return NextResponse.json(
      {
        success: false,
        code: "RESEND_FAILED",
        message: "Unable to resend verification code.",
      },
      { status: 500 }
    );
  }
}
