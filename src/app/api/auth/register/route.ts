// src/app/api/auth/register/route.ts
// POST /api/auth/register — create a new user with email/password

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { registerSchema } from "@/lib/validators/auth";
import { emailService } from "@/lib/email";
import { invitationsService } from "@/server/services/invitations.service";
import { isDatabaseConfigured } from "@/lib/env-checks";
import type { NextRequest } from "next/server";

function mapRegisterError(error: unknown): { status: number; message: string } {
  const message = error instanceof Error ? error.message : String(error);

  if (!isDatabaseConfigured(process.env["DATABASE_URL"])) {
    return {
      status: 503,
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
      message:
        "Cannot connect to database. Check DATABASE_URL credentials in .env.local.",
    };
  }

  return { status: 500, message: "Registration failed" };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as unknown;
    const { z } = await import("zod");
    const schemaWithInvite = registerSchema.and(
      z.object({
        inviteToken: z.string().optional(),
      })
    );
    const validated = schemaWithInvite.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message ?? "Validation failed" },
        { status: 422 }
      );
    }

    const { name, email, password, inviteToken } = validated.data as {
      name: string; email: string; password: string; confirmPassword: string; inviteToken?: string;
    };

    // Check if email already exists
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const [user] = await db
      .insert(users)
      .values({ name, email, passwordHash, emailVerified: new Date() })
      .returning();

    if (!user) throw new Error("Failed to create user");

    // Handle invite token
    if (inviteToken) {
      try {
        await invitationsService.accept(inviteToken, user.id);
      } catch {
        // Don't fail registration if invitation acceptance fails
      }
    }

    // Send welcome email (fire and forget)
    emailService.sendWelcome({ to: email, name }).catch(console.error);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/auth/register]", err);
    const mapped = mapRegisterError(err);
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }
}
