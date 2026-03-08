// src/app/api/auth/reset-password/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, passwordResetTokens } from "@/drizzle/schema";
import { eq, and, gt } from "drizzle-orm";
import { resetPasswordSchema } from "@/lib/validators/auth";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as unknown;
    const validated = resetPasswordSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.errors[0]?.message ?? "Invalid input" }, { status: 422 });
    }

    const { token, password } = validated.data;

    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.token, token), gt(passwordResetTokens.expires, new Date())))
      .limit(1);

    if (!resetToken) {
      return NextResponse.json({ error: "Reset link is invalid or has expired" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await Promise.all([
      db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, resetToken.userId)),
      db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, resetToken.id)),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/auth/reset-password]", err);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
