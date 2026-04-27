import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { legacyUsersTable } from "@/lib/auth/adapter-schema";

const DEMO_EMAIL = "demo@northstar.local";
const DEMO_PASSWORD = "NorthStarDemo123";

export async function POST(): Promise<NextResponse> {
  try {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

    const [existingUser] = await db
      .select({
        id: users.id,
        emailVerified: users.emailVerified,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(sql`lower(${users.email}) = ${DEMO_EMAIL}`)
      .limit(1);

    if (!existingUser) {
      await db.insert(legacyUsersTable).values({
        id: `usr_${nanoid(12)}`,
        name: "NorthStar Demo",
        username: "northstar_demo",
        email: DEMO_EMAIL,
        passwordHash,
        emailVerified: new Date(),
        bio: "Exploring the product in demo mode.",
      });
    } else {
      // Always ensure emailVerified and passwordHash are set for demo user
      await db
        .update(legacyUsersTable)
        .set({
          passwordHash,
          emailVerified: existingUser.emailVerified ?? new Date(),
          updatedAt: new Date(),
        })
        .where(eq(legacyUsersTable.id, existingUser.id));
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
