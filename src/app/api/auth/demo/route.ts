import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, userSubscriptions } from "@/drizzle/schema";
import { legacyUsersTable } from "@/lib/auth/adapter-schema";

const DEMO_EMAIL = "demo@northstar.local";
const DEMO_PASSWORD = "NorthStarDemo123";

export async function POST(): Promise<NextResponse> {
  try {
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
      // Only hash when creating the demo user for the first time
      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
      const demoUserId = `usr_${nanoid(12)}`;
      const now = new Date();
      await db.insert(legacyUsersTable).values({
        id: demoUserId,
        name: "NorthStar Demo",
        username: "northstar_demo",
        email: DEMO_EMAIL,
        passwordHash,
        emailVerified: now,
        bio: "Exploring the product in demo mode.",
      });
      await db
        .update(users)
        .set({ trialStartDate: now, isDemo: true })
        .where(eq(users.id, demoUserId));
      await db
        .insert(userSubscriptions)
        .values({
          userId: demoUserId,
          plan: "pro",
          status: "active",
          priceCents: 0,
          trialStartDate: now,
          planStartDate: now,
        })
        .onConflictDoNothing();
    } else if (!existingUser.emailVerified || !existingUser.passwordHash) {
      // Only update if the demo account is in a broken state
      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
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
