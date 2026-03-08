// src/lib/auth/helpers.ts
// Server-side auth helper functions
// Used in Server Components and API route handlers

import { auth } from "./config";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import type { User } from "@/drizzle/schema";

/**
 * Get the current session user ID from JWT.
 * Returns null if not authenticated.
 * Use in Server Components and API routes.
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

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user ?? null;
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
