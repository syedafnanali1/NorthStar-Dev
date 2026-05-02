// src/lib/auth/helpers.ts
// Server-side auth helper functions for Server Components and API handlers.

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { users } from "@/drizzle/schema";
import type { User } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { edgeAuth as auth } from "./edge-config";

/**
 * Get the current user ID from session.
 * Returns null if unauthenticated.
 */
export async function getSessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Get the full user object for the current session.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<User | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user ?? null;
  } catch (error) {
    // Compatibility fallback for databases that haven't been migrated
    // to the newest auth columns yet.
    console.warn("[auth] full user select failed, falling back to legacy columns", error);

    try {
      const [legacyUser] = await db
        .select({
          id: users.id,
          name: users.name,
          username: users.username,
          email: users.email,
          emailVerified: users.emailVerified,
          passwordHash: users.passwordHash,
          image: users.image,
          age: users.age,
          location: users.location,
          bio: users.bio,
          darkMode: users.darkMode,
          hasCompletedOnboarding: users.hasCompletedOnboarding,
          aiCoachingEnabled: users.aiCoachingEnabled,
          timezone: users.timezone,
          pushNotificationsEnabled: users.pushNotificationsEnabled,
          momentumScore: users.momentumScore,
          currentStreak: users.currentStreak,
          longestStreak: users.longestStreak,
          totalGoalsCompleted: users.totalGoalsCompleted,
          xpPoints: users.xpPoints,
          level: users.level,
          northStarScore: users.northStarScore,
          lastActiveAt: users.lastActiveAt,
          groupsJoined: users.groupsJoined,
          groupGoalsCompleted: users.groupGoalsCompleted,
          groupCommentsPosted: users.groupCommentsPosted,
          groupReactionsGiven: users.groupReactionsGiven,
          groupInvitesSent: users.groupInvitesSent,
          groupInvitesAccepted: users.groupInvitesAccepted,
          totalGroupEngagementScore: users.totalGroupEngagementScore,
          lastGroupActiveAt: users.lastGroupActiveAt,
          groupBehaviorProfile: users.groupBehaviorProfile,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!legacyUser) return null;

      return {
        ...legacyUser,
        phoneNumber: null,
        dateOfBirth: null,
        countryRegion: null,
        alwaysVerifySignIn: false,
        lastStepUpVerifiedAt: null,
        sessionVersion: 1,
        trialStartDate: null,
        isDemo: false,
        role: "member" as const,
      } as User;
    } catch {
      return null;
    }
  }
}

/**
 * Require authentication. Redirects to /auth/login if not authenticated.
 * Use at the top of protected Server Components.
 */
export async function requireAuth(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/auth/login");
  }
  return userId;
}

/**
 * Require authentication and return full user object.
 * Redirects to /auth/login if not authenticated.
 */
export async function requireAuthUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login");
  }
  return user;
}

/**
 * Redirect authenticated users away from auth pages.
 * Use in login/register pages.
 */
export async function redirectIfAuthenticated(to = "/dashboard"): Promise<void> {
  const userId = await getSessionUserId();
  if (userId) {
    redirect(to);
  }
}
