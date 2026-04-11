import { and, eq, gt } from "drizzle-orm";

import { authLoginSecurity, verificationTokens } from "@/drizzle/schema";
import { db } from "@/lib/db";

export const AUTH_SECURITY_LIMITS = {
  maxFailedLoginAttempts: 5,
  lockMinutes: 15,
  otpExpiresMinutes: 10,
  otpResendCooldownSeconds: 60,
  trustedDeviceDays: 30,
  maxTrustedDevices: 5,
  passwordHistoryDepth: 5,
  resetLinkExpiresMinutes: 20,
} as const;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fallbackIdentifier(userId: string): string {
  return `login_security:${userId}`;
}

async function getFallbackState(userId: string): Promise<{ failedAttempts: number; lockUntil: Date | null }> {
  const [row] = await db
    .select({ token: verificationTokens.token, expires: verificationTokens.expires })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, fallbackIdentifier(userId)),
        gt(verificationTokens.expires, new Date())
      )
    )
    .limit(1);

  if (!row?.token) return { failedAttempts: 0, lockUntil: null };
  const [failedRaw, lockUntilRaw] = row.token.split("|");
  const failedAttempts = Number(failedRaw ?? 0);
  const lockUntilMs = Number(lockUntilRaw ?? 0);
  return {
    failedAttempts: Number.isFinite(failedAttempts) ? failedAttempts : 0,
    lockUntil: lockUntilMs > Date.now() ? new Date(lockUntilMs) : null,
  };
}

async function saveFallbackState(userId: string, failedAttempts: number, lockUntil: Date | null): Promise<void> {
  const identifier = fallbackIdentifier(userId);
  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier));
  await db.insert(verificationTokens).values({
    identifier,
    token: `${failedAttempts}|${lockUntil?.getTime() ?? 0}`,
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
}

export function maskEmail(email: string): string {
  const [local, domain] = email.toLowerCase().split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] ?? "*"}*@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 2))}@${domain}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getLoginSecurityState(userId: string): Promise<{
  failedAttempts: number;
  lockUntil: Date | null;
}> {
  try {
    const [state] = await db
      .select({
        failedAttempts: authLoginSecurity.failedAttempts,
        lockUntil: authLoginSecurity.lockUntil,
      })
      .from(authLoginSecurity)
      .where(eq(authLoginSecurity.userId, userId))
      .limit(1);

    return {
      failedAttempts: state?.failedAttempts ?? 0,
      lockUntil: state?.lockUntil ?? null,
    };
  } catch (error) {
    console.warn("[auth-security] login security table unavailable", error);
    try {
      return await getFallbackState(userId);
    } catch (fallbackError) {
      console.warn("[auth-security] login security fallback read failed", fallbackError);
      return { failedAttempts: 0, lockUntil: null };
    }
  }
}

export async function isUserLocked(userId: string): Promise<{ locked: boolean; lockUntil: Date | null }> {
  const state = await getLoginSecurityState(userId);
  const now = Date.now();
  const lockUntilMs = state.lockUntil?.getTime() ?? 0;
  return {
    locked: lockUntilMs > now,
    lockUntil: lockUntilMs > now ? state.lockUntil : null,
  };
}

export async function recordFailedLogin(userId: string): Promise<{
  failedAttempts: number;
  lockUntil: Date | null;
  justLocked: boolean;
}> {
  const current = await getLoginSecurityState(userId);
  const now = new Date();

  if (current.lockUntil && current.lockUntil.getTime() > now.getTime()) {
    return {
      failedAttempts: current.failedAttempts,
      lockUntil: current.lockUntil,
      justLocked: false,
    };
  }

  const failedAttempts = (current.failedAttempts ?? 0) + 1;
  const shouldLock = failedAttempts >= AUTH_SECURITY_LIMITS.maxFailedLoginAttempts;
  const lockUntil = shouldLock
    ? new Date(now.getTime() + AUTH_SECURITY_LIMITS.lockMinutes * 60_000)
    : null;

  try {
    await db
      .insert(authLoginSecurity)
      .values({
        userId,
        failedAttempts: shouldLock ? 0 : failedAttempts,
        lockUntil,
        lastFailedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: authLoginSecurity.userId,
        set: {
          failedAttempts: shouldLock ? 0 : failedAttempts,
          lockUntil,
          lastFailedAt: now,
          updatedAt: now,
        },
      });
  } catch (error) {
    console.warn("[auth-security] failed to persist failed login", error);
    try {
      await saveFallbackState(userId, shouldLock ? 0 : failedAttempts, lockUntil);
    } catch (fallbackError) {
      console.warn("[auth-security] fallback persist failed", fallbackError);
    }
  }

  return {
    failedAttempts,
    lockUntil,
    justLocked: shouldLock,
  };
}

export async function clearFailedLogins(userId: string): Promise<void> {
  try {
    await db
      .insert(authLoginSecurity)
      .values({
        userId,
        failedAttempts: 0,
        lockUntil: null,
        lastSuccessfulAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: authLoginSecurity.userId,
        set: {
          failedAttempts: 0,
          lockUntil: null,
          lastSuccessfulAt: new Date(),
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.warn("[auth-security] failed to clear failed logins", error);
    try {
      await db
        .delete(verificationTokens)
        .where(eq(verificationTokens.identifier, fallbackIdentifier(userId)));
    } catch (fallbackError) {
      console.warn("[auth-security] fallback clear failed", fallbackError);
    }
  }
}

export async function applyMitigationDelay(): Promise<void> {
  await wait(320);
}
