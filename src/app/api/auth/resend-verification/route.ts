import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { users } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { authEmailService } from "@/lib/email/auth";
import {
  AUTH_SECURITY_LIMITS,
  createOtpChallenge,
  maskEmail,
  normalizeEmail,
} from "@/lib/auth/security";

const resendSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  mode: z.enum(["email", "signin"]).optional().default("email"),
});

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
    const verifyUrl = `${process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000"}/auth/verify-email?email=${encodeURIComponent(email)}&code=${encodeURIComponent(otpResult.otp ?? "")}&mode=${modeQuery}`;

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
          code: "EMAIL_SEND_FAILED",
          message:
            "We couldn't send a verification email. Please check the address and try again.",
        },
        { status: 502 }
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
