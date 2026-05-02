import { addMinutes } from "date-fns";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { passwordResetTokens, users } from "@/drizzle/schema";
import { appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { emailService } from "@/lib/email";
import {
  AUTH_SECURITY_LIMITS,
  createSignedResetToken,
  normalizeEmail,
} from "@/lib/auth/security";
import { forgotPasswordSchema } from "@/lib/validators/auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as unknown;
    const validated = forgotPasswordSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, code: "VALIDATION_ERROR", message: "Valid email required" },
        { status: 422 }
      );
    }

    const normalizedEmail = normalizeEmail(validated.data.email);

    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`)
      .limit(1);

    // Always return 200 to reduce user enumeration.
    if (!user) {
      return NextResponse.json({
        success: true,
        code: "RESET_EMAIL_SENT_IF_EXISTS",
        message: "If the account exists, a reset link has been sent.",
      });
    }

    const { tokenId, signedToken } = await createSignedResetToken();

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token: tokenId,
      expires: addMinutes(new Date(), AUTH_SECURITY_LIMITS.resetLinkExpiresMinutes),
    });

    const resetUrl = appUrl(`/auth/reset-password?token=${signedToken}`);
    await emailService.sendPasswordReset({ to: user.email, resetUrl });

    return NextResponse.json({
      success: true,
      code: "RESET_EMAIL_SENT",
      message: "If the account exists, a reset link has been sent.",
    });
  } catch (err) {
    console.error("[POST /api/auth/forgot-password]", err);
    return NextResponse.json(
      {
        success: false,
        code: "RESET_EMAIL_FAILED",
        message: "Failed to send reset email",
      },
      { status: 500 }
    );
  }
}
