import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { users, userAuthProfiles } from "@/drizzle/schema";
import { isDatabaseConfigured } from "@/lib/env-checks";
import { authEmailService } from "@/lib/email/auth";
import {
  appendPasswordHistory,
  AUTH_SECURITY_LIMITS,
  createOtpChallenge,
  maskEmail,
  normalizeEmail,
} from "@/lib/auth/security";
import { registerSchema } from "@/lib/validators/auth";
import { invitationsService } from "@/server/services/invitations.service";

function jsonError(status: number, code: string, message: string, data?: Record<string, unknown>) {
  return NextResponse.json(
    {
      success: false,
      code,
      message,
      ...(data ? { data } : {}),
    },
    { status }
  );
}

function slugifyUsername(value: string): string {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return base || "northstar_user";
}

async function ensureUniqueUsername(candidate: string): Promise<string> {
  const normalized = slugifyUsername(candidate).slice(0, 30);

  for (let index = 0; index < 100; index += 1) {
    const suffix = index === 0 ? "" : `_${index}`;
    const next = `${normalized}${suffix}`.slice(0, 30);

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, next))
      .limit(1);

    if (!existing) return next;
  }

  return `${normalized.slice(0, 24)}_${Date.now().toString().slice(-5)}`;
}

function mapRegisterError(error: unknown): { status: number; code: string; message: string } {
  const message = error instanceof Error ? error.message : String(error);

  if (!isDatabaseConfigured(process.env["DATABASE_URL"])) {
    return {
      status: 503,
      code: "DATABASE_UNAVAILABLE",
      message:
        "Database is not configured. Update DATABASE_URL in .env.local and run `npm run db:push`.",
    };
  }

  if (
    /password authentication failed|DATABASE_URL|ECONNREFUSED|ENOTFOUND|connection/i.test(
      message
    )
  ) {
    return {
      status: 503,
      code: "DATABASE_UNAVAILABLE",
      message:
        "Cannot connect to database. Check DATABASE_URL credentials in .env.local.",
    };
  }

  return { status: 500, code: "REGISTER_FAILED", message: "Registration failed" };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as unknown;
    const { z } = await import("zod");
    const schemaWithInvite = registerSchema.and(
      z.object({
        inviteToken: z.string().optional(),
      })
    );

    const validated = schemaWithInvite.safeParse(body);
    if (!validated.success) {
      return jsonError(422, "VALIDATION_ERROR", validated.error.errors[0]?.message ?? "Validation failed");
    }

    const {
      fullName,
      email,
      phoneNumber,
      password,
      dateOfBirth,
      countryRegion,
      username,
      profilePhotoDataUrl,
      referralCode,
      inviteToken,
    } = validated.data;

    const normalizedEmail = normalizeEmail(email);
    const normalizedName = fullName.trim().replace(/\s+/g, " ");

    const [existing] = await db
      .select({
        id: users.id,
        emailVerified: users.emailVerified,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`)
      .limit(1);

    if (existing?.emailVerified && existing.passwordHash) {
      return jsonError(409, "EMAIL_ALREADY_USED", "An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const resolvedUsername = await ensureUniqueUsername(
      username?.trim() || slugifyUsername(normalizedName)
    );

    let userId: string;

    if (existing) {
      await db
        .update(users)
        .set({
          name: normalizedName,
          username: resolvedUsername,
          passwordHash,
          image: profilePhotoDataUrl ?? null,
          emailVerified: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id));

      userId = existing.id;
    } else {
      const [created] = await db
        .insert(users)
        .values({
          name: normalizedName,
          username: resolvedUsername,
          email: normalizedEmail,
          passwordHash,
          image: profilePhotoDataUrl ?? null,
          emailVerified: null,
        })
        .returning({ id: users.id });

      if (!created) {
        return jsonError(500, "REGISTER_FAILED", "Failed to create account");
      }

      userId = created.id;
    }

    try {
      await db
        .insert(userAuthProfiles)
        .values({
          userId,
          phoneNumber,
          dateOfBirth: new Date(dateOfBirth),
          countryRegion,
          referralCode: referralCode?.trim() || null,
        })
        .onConflictDoUpdate({
          target: userAuthProfiles.userId,
          set: {
            phoneNumber,
            dateOfBirth: new Date(dateOfBirth),
            countryRegion,
            referralCode: referralCode?.trim() || null,
            updatedAt: new Date(),
          },
        });
    } catch (profileError) {
      console.warn("[POST /api/auth/register] user_auth_profiles_write_failed", profileError);
    }

    await appendPasswordHistory(userId, passwordHash);

    if (inviteToken) {
      try {
        await invitationsService.accept(inviteToken, userId);
      } catch {
        // Registration should continue even if invite acceptance fails.
      }
    }

    const otpResult = await createOtpChallenge({
      userId,
      email: normalizedEmail,
      purpose: "email_verification",
      context: { flow: "registration" },
      force: true,
    });

    if (otpResult.status !== "created" || !otpResult.otp || !otpResult.expiresAt) {
      return jsonError(
        429,
        "OTP_COOLDOWN",
        `Please wait ${otpResult.waitSeconds}s before requesting a new code.`,
        { waitSeconds: otpResult.waitSeconds }
      );
    }

    const verifyUrl = `${process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000"}/auth/verify-email?email=${encodeURIComponent(normalizedEmail)}&code=${encodeURIComponent(otpResult.otp)}`;

    try {
      await authEmailService.sendEmailVerificationOtp({
        to: normalizedEmail,
        otp: otpResult.otp,
        verifyUrl,
      });
    } catch (emailError) {
      console.error("[POST /api/auth/register] verification_email_failed", emailError);
      return jsonError(
        502,
        "VERIFICATION_EMAIL_FAILED",
        "We couldn't send a verification email. Please check the address and try again.",
        {
          canUpdateEmail: true,
          resendAfterSeconds: AUTH_SECURITY_LIMITS.otpResendCooldownSeconds,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        code: "VERIFICATION_REQUIRED",
        message: "Account created. Verify your email to activate your account.",
        data: {
          email: normalizedEmail,
          emailMasked: maskEmail(normalizedEmail),
          resendAfterSeconds: AUTH_SECURITY_LIMITS.otpResendCooldownSeconds,
          redirectTo: `/auth/verify-email?email=${encodeURIComponent(normalizedEmail)}`,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/auth/register]", err);
    const mapped = mapRegisterError(err);
    return jsonError(mapped.status, mapped.code, mapped.message);
  }
}
