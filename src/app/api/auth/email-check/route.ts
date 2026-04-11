import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { users } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { normalizeEmail } from "@/lib/auth/security";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim();

  if (!email) {
    return NextResponse.json({ success: false, code: "EMAIL_REQUIRED", message: "Email is required" }, { status: 400 });
  }

  const normalizedEmail = normalizeEmail(email);

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${normalizedEmail}`)
    .limit(1);

  return NextResponse.json({
    success: true,
    code: "EMAIL_CHECKED",
    data: {
      email: normalizedEmail,
      available: !existing,
    },
  });
}
