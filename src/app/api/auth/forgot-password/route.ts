// src/app/api/auth/forgot-password/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, passwordResetTokens } from "@/drizzle/schema";
import { sql } from "drizzle-orm";
import { forgotPasswordSchema } from "@/lib/validators/auth";
import { emailService } from "@/lib/email";
import { nanoid } from "nanoid";
import { addHours } from "date-fns";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as unknown;
    const validated = forgotPasswordSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: "Valid email required" }, { status: 422 });
    }

    const normalizedEmail = validated.data.email.trim().toLowerCase();

    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`)
      .limit(1);

    // Always return 200 to prevent email enumeration
    if (!user) return NextResponse.json({ success: true });

    const token = nanoid(48);
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expires: addHours(new Date(), 1),
    });

    const resetUrl = `${process.env["NEXT_PUBLIC_APP_URL"]}/auth/reset-password?token=${token}`;
    await emailService.sendPasswordReset({ to: user.email, resetUrl });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/auth/forgot-password]", err);
    return NextResponse.json({ error: "Failed to send reset email" }, { status: 500 });
  }
}
