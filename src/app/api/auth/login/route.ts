import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const runtime = "edge";

import { accounts, users } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { authEmailService } from "@/lib/email/auth";
import {
  applyMitigationDelay,
  AUTH_SECURITY_LIMITS,
  isUserLocked,
  normalizeEmail,
  recordFailedLogin,
} from "@/lib/auth/security";
import { loginSchema } from "@/lib/validators/auth";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as unknown;
    const validated = loginSchema.safeParse(body);

    if (!validated.success) {
      await applyMitigationDelay();
      return NextResponse.json(
        {
          success: false,
          code: "VALIDATION_ERROR",
          message: validated.error.errors[0]?.message ?? "Invalid login payload",
        },
        { status: 422 }
      );
    }

    const email = normalizeEmail(validated.data.email);
    const password = validated.data.password;

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        emailVerified: users.emailVerified,
      })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);

    if (!user) {
      await applyMitigationDelay();
      return NextResponse.json(
        {
          success: false,
          code: "NO_ACCOUNT",
          message: "No account found with this email. Would you like to create one?",
          data: {
            registerUrl: "/auth/register",
          },
        },
        { status: 404 }
      );
    }

    const lockState = await isUserLocked(user.id);
    if (lockState.locked && lockState.lockUntil) {
      await applyMitigationDelay();
      return NextResponse.json(
        {
          success: false,
          code: "ACCOUNT_LOCKED",
          message: `Too many failed attempts. Try again after ${lockState.lockUntil.toISOString()}.`,
          data: {
            lockUntil: lockState.lockUntil.toISOString(),
            forgotPasswordUrl: "/auth/forgot-password",
          },
        },
        { status: 423 }
      );
    }

    if (!user.passwordHash) {
      const [account] = await db
        .select({ provider: accounts.provider })
        .from(accounts)
        .where(eq(accounts.userId, user.id))
        .limit(1);

      await applyMitigationDelay();
      return NextResponse.json(
        {
          success: false,
          code: "PASSWORD_NOT_SET",
          message: "This account uses social sign-in. Use Google or reset your password to continue.",
          data: {
            forgotPasswordUrl: "/auth/forgot-password",
            provider: account?.provider ?? null,
          },
        },
        { status: 400 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const failed = await recordFailedLogin(user.id);
      if (failed.justLocked) {
        void authEmailService
          .sendAccountLockedAlert({ to: user.email, lockMinutes: AUTH_SECURITY_LIMITS.lockMinutes })
          .catch((error) => {
            console.error("[POST /api/auth/login] lock_alert_failed", error);
          });
      }

      await applyMitigationDelay();
      return NextResponse.json(
        {
          success: false,
          code: failed.justLocked ? "ACCOUNT_LOCKED" : "INCORRECT_PASSWORD",
          message: failed.justLocked
            ? `Too many failed attempts. Your account is locked for ${AUTH_SECURITY_LIMITS.lockMinutes} minutes.`
            : "Incorrect password. Please try again or reset your password.",
          data: {
            forgotPasswordUrl: "/auth/forgot-password",
            remainingAttempts: failed.justLocked
              ? 0
              : Math.max(AUTH_SECURITY_LIMITS.maxFailedLoginAttempts - failed.failedAttempts, 0),
          },
        },
        { status: failed.justLocked ? 423 : 401 }
      );
    }

    if (!user.emailVerified) {
      await applyMitigationDelay();
      return NextResponse.json(
        {
          success: false,
          code: "EMAIL_UNVERIFIED",
          message: "Please verify your email before signing in.",
          data: {
            verifyUrl: `/auth/verify-email?email=${encodeURIComponent(email)}`,
            resendUrl: "/api/auth/resend-verification",
          },
        },
        { status: 403 }
      );
    }

    await applyMitigationDelay();
    return NextResponse.json({
      success: true,
      code: "LOGIN_ALLOWED",
      message: "Credentials verified. Continue sign in.",
    });
  } catch (error) {
    console.error("[POST /api/auth/login]", error);
    return NextResponse.json(
      {
        success: false,
        code: "LOGIN_CHECK_FAILED",
        message: "Unable to verify login right now. Please try again.",
      },
      { status: 500 }
    );
  }
}
