import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { passwordResetTokens, users } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { authEmailService } from "@/lib/email/auth";
import {
  appendPasswordHistory,
  hasUsedRecentPassword,
  invalidateAllUserSessions,
  verifySignedResetToken,
} from "@/lib/auth/security";
import { resetPasswordSchema } from "@/lib/validators/auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as unknown;
    const validated = resetPasswordSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          code: "VALIDATION_ERROR",
          message: validated.error.errors[0]?.message ?? "Invalid input",
        },
        { status: 422 }
      );
    }

    const { token, password } = validated.data;
    const tokenId = verifySignedResetToken(token);

    if (!tokenId) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_TOKEN",
          message: "Reset link is invalid or has expired",
        },
        { status: 400 }
      );
    }

    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.token, tokenId), gt(passwordResetTokens.expires, new Date())))
      .limit(1);

    if (!resetToken) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_TOKEN",
          message: "Reset link is invalid or has expired",
        },
        { status: 400 }
      );
    }

    const [user] = await db
      .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, resetToken.userId))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          code: "USER_NOT_FOUND",
          message: "Account not found.",
        },
        { status: 404 }
      );
    }

    if (user.passwordHash && (await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json(
        {
          success: false,
          code: "PASSWORD_REUSED",
          message: "New password must differ from your recent passwords.",
        },
        { status: 400 }
      );
    }

    const reused = await hasUsedRecentPassword(user.id, password);
    if (reused) {
      return NextResponse.json(
        {
          success: false,
          code: "PASSWORD_REUSED",
          message: "New password must differ from your recent passwords.",
        },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await Promise.all([
      db
        .update(users)
        .set({
          passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id)),
      db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id)),
    ]);

    await appendPasswordHistory(user.id, passwordHash);
    await invalidateAllUserSessions(user.id);
    void authEmailService
      .sendPasswordChangedNotice({ to: user.email })
      .catch((error) => console.error("[POST /api/auth/reset-password] notify_failed", error));

    return NextResponse.json({
      success: true,
      code: "PASSWORD_RESET_SUCCESS",
      message: "Password reset successful. Please sign in again.",
      data: {
        loginUrl: "/auth/login?reset=1",
      },
    });
  } catch (err) {
    console.error("[POST /api/auth/reset-password]", err);
    return NextResponse.json(
      {
        success: false,
        code: "PASSWORD_RESET_FAILED",
        message: "Failed to reset password",
      },
      { status: 500 }
    );
  }
}
