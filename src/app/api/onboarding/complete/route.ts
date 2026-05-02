// src/app/api/onboarding/complete/route.ts
// POST /api/onboarding/complete — mark the current user as having completed onboarding

export const runtime = "edge";

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";

export async function POST(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await db
      .update(users)
      .set({ hasCompletedOnboarding: true, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/onboarding/complete]", err);
    return NextResponse.json(
      { error: "Failed to update onboarding status" },
      { status: 500 }
    );
  }
}
