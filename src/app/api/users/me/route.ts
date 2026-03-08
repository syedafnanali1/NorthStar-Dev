// src/app/api/users/me/route.ts
// GET   /api/users/me — get current user profile
// PATCH /api/users/me — update current user profile

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { updateProfileSchema } from "@/lib/validators/profile";
import type { NextRequest } from "next/server";

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      age: users.age,
      location: users.location,
      bio: users.bio,
      darkMode: users.darkMode,
      momentumScore: users.momentumScore,
      currentStreak: users.currentStreak,
      longestStreak: users.longestStreak,
      totalGoalsCompleted: users.totalGoalsCompleted,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    const validated = updateProfileSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 422 }
      );
    }

    const { name, age, location, bio, darkMode } = validated.data;

    const [updated] = await db
      .update(users)
      .set({
        ...(name !== undefined && { name }),
        ...(age !== undefined && { age }),
        ...(location !== undefined && { location }),
        ...(bio !== undefined && { bio }),
        ...(darkMode !== undefined && { darkMode }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        age: users.age,
        location: users.location,
        bio: users.bio,
        darkMode: users.darkMode,
      });

    return NextResponse.json({ user: updated });
  } catch (err) {
    console.error("[PATCH /api/users/me]", err);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
