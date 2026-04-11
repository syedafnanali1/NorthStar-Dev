import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";

const DEMO_EMAIL = "demo@northstar.local";
const DEMO_PASSWORD = "NorthStarDemo123";

export async function POST(): Promise<NextResponse> {
  try {
    const [existingUser] = await db
      .select({
        id: users.id,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(sql`lower(${users.email}) = ${DEMO_EMAIL}`)
      .limit(1);

    if (!existingUser) {
      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
      await db.insert(users).values({
        name: "NorthStar Demo",
        email: DEMO_EMAIL,
        passwordHash,
        emailVerified: new Date(),
        location: "Demo Mode",
        bio: "Exploring the product in demo mode.",
      });
    } else if (!existingUser.passwordHash) {
      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
      await db
        .update(users)
        .set({
          passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id));
    }

    return NextResponse.json({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
  } catch (error) {
    console.error("[POST /api/auth/demo]", error);
    return NextResponse.json(
      { error: "Demo mode is unavailable right now." },
      { status: 500 }
    );
  }
}
