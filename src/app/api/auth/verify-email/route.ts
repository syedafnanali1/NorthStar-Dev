import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { users, verificationTokens } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { emailService } from "@/lib/email";
import {
  clearFailedLogins,
  normalizeEmail,
  verifyOtpChallenge,
} from "@/lib/auth/security";

const verifySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  otp: z.string().trim().regex(/^\d{6}$/, "Verification code must be 6 digits"),
  mode: z.enum(["email", "signin"]).optional().default("email"),
  provider: z.enum(["google", "facebook"]).optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as unknown;
    const validated = verifySchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          code: "VALIDATION_ERROR",
          message: validated.error.errors[0]?.message ?? "Invalid verification payload",
        },
        { status: 422 }
      );
    }

    const email = normalizeEmail(validated.data.email);
    const mode = validated.data.mode;
    const provider = validated.data.provider;
    const purpose = mode === "signin" ? "signin_step_up" : "email_verification";

    const [user] = await db
      .select({ id: users.id, name: users.name, emailVerified: users.emailVerified })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_CODE",
          message: "Invalid or expired verification code.",
        },
        { status: 400 }
      );
    }

    const result = await verifyOtpChallenge({
      userId: user.id,
      email,
      purpose,
      otp: validated.data.otp,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          code: result.reason === "expired" ? "CODE_EXPIRED" : "INVALID_CODE",
          message:
            result.reason === "expired"
              ? "Code expired. Request a new one."
              : "Invalid verification code.",
        },
        { status: 400 }
      );
    }

    await db
      .update(users)
      .set({
        emailVerified:
          purpose === "email_verification"
            ? new Date()
            : user.emailVerified ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    const isSignInMode = purpose === "signin_step_up";

    await clearFailedLogins(user.id);

    if (isSignInMode) {
      await db
        .delete(verificationTokens)
        .where(eq(verificationTokens.identifier, `stepup_passed:${user.id}`));

      await db.insert(verificationTokens).values({
        identifier: `stepup_passed:${user.id}`,
        token: String(Date.now()),
        expires: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
      });
    }

    if (purpose === "email_verification" && user.name) {
      void emailService
        .sendWelcome({ to: email, name: user.name })
        .catch((error) => console.error("[POST /api/auth/verify-email] welcome_failed", error));
    }

    return NextResponse.json({
      success: true,
      code: isSignInMode ? "SIGNIN_VERIFIED" : "EMAIL_VERIFIED",
      message: isSignInMode
        ? "Sign-in verification complete. Continue sign-in."
        : "Email verified successfully. You can now sign in.",
      data: {
        loginUrl:
          isSignInMode && provider
            ? `/api/auth/signin/${provider}?callbackUrl=${encodeURIComponent("/dashboard")}`
            : "/auth/login?verified=1",
      },
    });
  } catch (error) {
    console.error("[POST /api/auth/verify-email]", error);
    return NextResponse.json(
      {
        success: false,
        code: "VERIFY_FAILED",
        message: "Unable to verify code right now.",
      },
      { status: 500 }
    );
  }
}
