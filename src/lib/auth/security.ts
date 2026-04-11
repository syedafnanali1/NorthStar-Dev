import bcrypt from "bcryptjs";
import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";

import { db } from "@/lib/db";
import {
  authEmailOtps,
  sessions,
  userPasswordHistory,
  userTrustedDevices,
  verificationTokens,
} from "@/drizzle/schema";
import {
  AUTH_SECURITY_LIMITS,
  applyMitigationDelay,
  clearFailedLogins,
  getLoginSecurityState,
  isUserLocked,
  maskEmail,
  normalizeEmail,
  recordFailedLogin,
} from "./security-core";

export {
  AUTH_SECURITY_LIMITS,
  applyMitigationDelay,
  clearFailedLogins,
  getLoginSecurityState,
  isUserLocked,
  maskEmail,
  normalizeEmail,
  recordFailedLogin,
};

const securitySecret = process.env["AUTH_SECURITY_SECRET"] ?? process.env["AUTH_SECRET"] ?? "dev-auth-security-secret";

export type OtpPurpose = "email_verification" | "signin_step_up";

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function hashOtp(otp: string, purpose: OtpPurpose, email: string): string {
  return createHash("sha256")
    .update(`${securitySecret}:${purpose}:${email.trim().toLowerCase()}:${otp}`)
    .digest("hex");
}

export function generateSixDigitOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function computeFingerprintHash(input: {
  userAgent?: string | null;
  screen?: string | null;
  timezone?: string | null;
}): string {
  const normalized = [
    input.userAgent?.trim().toLowerCase() ?? "unknown",
    input.screen?.trim().toLowerCase() ?? "unknown",
    input.timezone?.trim().toLowerCase() ?? "unknown",
  ].join("|");

  return createHash("sha256")
    .update(`${securitySecret}:fingerprint:${normalized}`)
    .digest("hex");
}

export function getClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}

interface CreateOtpParams {
  userId?: string | null;
  email: string;
  purpose: OtpPurpose;
  context?: Record<string, unknown>;
  force?: boolean;
}

interface CreateOtpResult {
  status: "created" | "cooldown";
  otp?: string;
  expiresAt?: Date;
  resendAvailableAt: Date;
  waitSeconds: number;
}

function otpQueryFilters(params: { userId?: string | null; email: string; purpose: OtpPurpose }) {
  const normalizedEmail = normalizeEmail(params.email);
  return and(
    params.userId ? eq(authEmailOtps.userId, params.userId) : isNull(authEmailOtps.userId),
    eq(authEmailOtps.email, normalizedEmail),
    eq(authEmailOtps.purpose, params.purpose),
    isNull(authEmailOtps.usedAt)
  );
}

function fallbackOtpIdentifier(input: { email: string; purpose: OtpPurpose; userId?: string | null }): string {
  const userPart = input.userId ? `${input.userId}:` : "";
  return `auth_otp:${input.purpose}:${userPart}${normalizeEmail(input.email)}`;
}

async function createOtpChallengeFallback(params: CreateOtpParams): Promise<CreateOtpResult> {
  const normalizedEmail = normalizeEmail(params.email);
  const identifier = fallbackOtpIdentifier({
    email: normalizedEmail,
    purpose: params.purpose,
    userId: params.userId,
  });
  const now = new Date();

  const [latest] = await db
    .select({ token: verificationTokens.token })
    .from(verificationTokens)
    .where(and(eq(verificationTokens.identifier, identifier), gt(verificationTokens.expires, now)))
    .limit(1);

  if (latest?.token && !params.force) {
    const [issuedAtRaw] = latest.token.split("|");
    const issuedAt = Number(issuedAtRaw ?? 0);
    const waitSeconds = Math.max(
      AUTH_SECURITY_LIMITS.otpResendCooldownSeconds - Math.floor((Date.now() - issuedAt) / 1000),
      0
    );
    if (waitSeconds > 0) {
      return {
        status: "cooldown",
        resendAvailableAt: new Date(issuedAt + AUTH_SECURITY_LIMITS.otpResendCooldownSeconds * 1000),
        waitSeconds,
      };
    }
  }

  const otp = generateSixDigitOtp();
  const issuedAt = Date.now();
  const expiresAt = new Date(issuedAt + AUTH_SECURITY_LIMITS.otpExpiresMinutes * 60_000);
  const otpHash = hashOtp(otp, params.purpose, normalizedEmail);

  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier));
  await db.insert(verificationTokens).values({
    identifier,
    token: `${issuedAt}|${otpHash}`,
    expires: expiresAt,
  });

  return {
    status: "created",
    otp,
    expiresAt,
    resendAvailableAt: new Date(issuedAt + AUTH_SECURITY_LIMITS.otpResendCooldownSeconds * 1000),
    waitSeconds: AUTH_SECURITY_LIMITS.otpResendCooldownSeconds,
  };
}

async function verifyOtpChallengeFallback(input: {
  userId?: string | null;
  email: string;
  purpose: OtpPurpose;
  otp: string;
}): Promise<{ ok: boolean; reason?: "expired" | "invalid" }> {
  const identifier = fallbackOtpIdentifier({
    email: normalizeEmail(input.email),
    purpose: input.purpose,
    userId: input.userId,
  });
  const now = new Date();

  const [challenge] = await db
    .select({ token: verificationTokens.token, expires: verificationTokens.expires })
    .from(verificationTokens)
    .where(and(eq(verificationTokens.identifier, identifier), gt(verificationTokens.expires, now)))
    .limit(1);

  if (!challenge) return { ok: false, reason: "expired" };
  if (challenge.expires <= now) return { ok: false, reason: "expired" };

  const parts = challenge.token.split("|");
  const storedHash = parts[1];
  if (!storedHash) return { ok: false, reason: "invalid" };

  const providedHash = hashOtp(input.otp, input.purpose, normalizeEmail(input.email));
  if (!safeEqual(storedHash, providedHash)) return { ok: false, reason: "invalid" };

  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier));
  return { ok: true };
}

export async function createOtpChallenge(params: CreateOtpParams): Promise<CreateOtpResult> {
  try {
    const normalizedEmail = normalizeEmail(params.email);
    const now = new Date();

    const [latestActive] = await db
      .select({
        id: authEmailOtps.id,
        createdAt: authEmailOtps.createdAt,
        expiresAt: authEmailOtps.expiresAt,
      })
      .from(authEmailOtps)
      .where(
        and(
          otpQueryFilters({ userId: params.userId, email: normalizedEmail, purpose: params.purpose }),
          gt(authEmailOtps.expiresAt, now)
        )
      )
      .orderBy(desc(authEmailOtps.createdAt))
      .limit(1);

    if (latestActive?.createdAt && !params.force) {
      const elapsedSeconds = Math.floor((Date.now() - latestActive.createdAt.getTime()) / 1000);
      const waitSeconds = Math.max(AUTH_SECURITY_LIMITS.otpResendCooldownSeconds - elapsedSeconds, 0);
      if (waitSeconds > 0) {
        return {
          status: "cooldown",
          resendAvailableAt: new Date(latestActive.createdAt.getTime() + AUTH_SECURITY_LIMITS.otpResendCooldownSeconds * 1000),
          waitSeconds,
        };
      }
    }

    const otp = generateSixDigitOtp();
    const expiresAt = new Date(Date.now() + AUTH_SECURITY_LIMITS.otpExpiresMinutes * 60_000);

    await db
      .delete(authEmailOtps)
      .where(otpQueryFilters({ userId: params.userId, email: normalizedEmail, purpose: params.purpose }));

    await db.insert(authEmailOtps).values({
      userId: params.userId ?? null,
      email: normalizedEmail,
      purpose: params.purpose,
      otpHash: hashOtp(otp, params.purpose, normalizedEmail),
      context: params.context ?? {},
      expiresAt,
    });

    return {
      status: "created",
      otp,
      expiresAt,
      resendAvailableAt: new Date(Date.now() + AUTH_SECURITY_LIMITS.otpResendCooldownSeconds * 1000),
      waitSeconds: AUTH_SECURITY_LIMITS.otpResendCooldownSeconds,
    };
  } catch (error) {
    console.warn("[auth-security] OTP table unavailable, using fallback store", error);
    return createOtpChallengeFallback(params);
  }
}

export async function verifyOtpChallenge(input: {
  userId?: string | null;
  email: string;
  purpose: OtpPurpose;
  otp: string;
}): Promise<{ ok: boolean; reason?: "expired" | "invalid" }> {
  try {
    const normalizedEmail = normalizeEmail(input.email);
    const now = new Date();

    const [challenge] = await db
      .select({
        id: authEmailOtps.id,
        otpHash: authEmailOtps.otpHash,
        expiresAt: authEmailOtps.expiresAt,
      })
      .from(authEmailOtps)
      .where(otpQueryFilters({ userId: input.userId, email: normalizedEmail, purpose: input.purpose }))
      .orderBy(desc(authEmailOtps.createdAt))
      .limit(1);

    if (!challenge) return { ok: false, reason: "expired" };
    if (challenge.expiresAt <= now) return { ok: false, reason: "expired" };

    const providedHash = hashOtp(input.otp, input.purpose, normalizedEmail);
    if (!safeEqual(providedHash, challenge.otpHash)) {
      return { ok: false, reason: "invalid" };
    }

    await db
      .update(authEmailOtps)
      .set({ usedAt: new Date() })
      .where(eq(authEmailOtps.id, challenge.id));

    return { ok: true };
  } catch (error) {
    console.warn("[auth-security] OTP verify fallback", error);
    return verifyOtpChallengeFallback(input);
  }
}

export async function hasUsedRecentPassword(userId: string, candidatePassword: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ passwordHash: userPasswordHistory.passwordHash })
      .from(userPasswordHistory)
      .where(eq(userPasswordHistory.userId, userId))
      .orderBy(desc(userPasswordHistory.createdAt))
      .limit(AUTH_SECURITY_LIMITS.passwordHistoryDepth);

    for (const row of rows) {
      if (await bcrypt.compare(candidatePassword, row.passwordHash)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.warn("[auth-security] password history fallback read", error);
    const rows = await db
      .select({ token: verificationTokens.token })
      .from(verificationTokens)
      .where(eq(verificationTokens.identifier, `pw_history:${userId}`));

    const ordered = rows
      .map((row) => {
        const [createdAtRaw, passwordHash] = row.token.split("|");
        return { createdAt: Number(createdAtRaw ?? 0), passwordHash };
      })
      .filter((entry): entry is { createdAt: number; passwordHash: string } => Boolean(entry.passwordHash))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, AUTH_SECURITY_LIMITS.passwordHistoryDepth);

    for (const entry of ordered) {
      if (await bcrypt.compare(candidatePassword, entry.passwordHash)) return true;
    }

    return false;
  }
}

export async function appendPasswordHistory(userId: string, passwordHash: string): Promise<void> {
  try {
    await db.insert(userPasswordHistory).values({ userId, passwordHash });

    const rows = await db
      .select({ id: userPasswordHistory.id })
      .from(userPasswordHistory)
      .where(eq(userPasswordHistory.userId, userId))
      .orderBy(desc(userPasswordHistory.createdAt));

    const staleIds = rows
      .slice(AUTH_SECURITY_LIMITS.passwordHistoryDepth)
      .map((row) => row.id);

    if (staleIds.length > 0) {
      await db.delete(userPasswordHistory).where(inArray(userPasswordHistory.id, staleIds));
    }
  } catch (error) {
    console.warn("[auth-security] password history fallback write", error);
    await db.insert(verificationTokens).values({
      identifier: `pw_history:${userId}`,
      token: `${Date.now()}|${passwordHash}`,
      expires: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000),
    });

    const rows = await db
      .select({ token: verificationTokens.token })
      .from(verificationTokens)
      .where(eq(verificationTokens.identifier, `pw_history:${userId}`));

    const staleTokens = rows
      .map((row) => row.token)
      .map((token) => {
        const [createdAtRaw] = token.split("|");
        return { token, createdAt: Number(createdAtRaw ?? 0) };
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(AUTH_SECURITY_LIMITS.passwordHistoryDepth)
      .map((entry) => entry.token);

    if (staleTokens.length > 0) {
      await db
        .delete(verificationTokens)
        .where(
          and(
            eq(verificationTokens.identifier, `pw_history:${userId}`),
            inArray(verificationTokens.token, staleTokens)
          )
        );
    }
  }
}

export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export function createSignedResetToken(): { tokenId: string; signedToken: string } {
  const tokenId = randomBytes(24).toString("hex");
  const signature = createHmac("sha256", securitySecret)
    .update(`password-reset:${tokenId}`)
    .digest("hex");

  return {
    tokenId,
    signedToken: `${tokenId}.${signature}`,
  };
}

export function verifySignedResetToken(signedToken: string): string | null {
  const [tokenId, signature] = signedToken.split(".");
  if (!tokenId || !signature) return null;

  const expected = createHmac("sha256", securitySecret)
    .update(`password-reset:${tokenId}`)
    .digest("hex");

  if (!safeEqual(expected, signature)) return null;
  return tokenId;
}

interface TrustDeviceParams {
  userId: string;
  fingerprintHash: string;
  deviceLabel?: string | null;
  ipAddress?: string | null;
  country?: string | null;
  city?: string | null;
  days?: number;
}

export async function isTrustedDevice(userId: string, fingerprintHash: string): Promise<boolean> {
  const [device] = await db
    .select({ id: userTrustedDevices.id })
    .from(userTrustedDevices)
    .where(
      and(
        eq(userTrustedDevices.userId, userId),
        eq(userTrustedDevices.fingerprintHash, fingerprintHash),
        gt(userTrustedDevices.trustedUntil, new Date())
      )
    )
    .limit(1);

  return Boolean(device);
}

export async function trustDevice(params: TrustDeviceParams): Promise<void> {
  const now = new Date();
  const trustedUntil = new Date(
    now.getTime() + (params.days ?? AUTH_SECURITY_LIMITS.trustedDeviceDays) * 24 * 60 * 60 * 1000
  );

  await db
    .insert(userTrustedDevices)
    .values({
      userId: params.userId,
      fingerprintHash: params.fingerprintHash,
      deviceLabel: params.deviceLabel ?? null,
      ipAddress: params.ipAddress ?? null,
      country: params.country ?? null,
      city: params.city ?? null,
      trustedUntil,
      lastSeenAt: now,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [userTrustedDevices.userId, userTrustedDevices.fingerprintHash],
      set: {
        deviceLabel: params.deviceLabel ?? null,
        ipAddress: params.ipAddress ?? null,
        country: params.country ?? null,
        city: params.city ?? null,
        trustedUntil,
        lastSeenAt: now,
      },
    });

  const devices = await db
    .select({ id: userTrustedDevices.id })
    .from(userTrustedDevices)
    .where(eq(userTrustedDevices.userId, params.userId))
    .orderBy(desc(userTrustedDevices.lastSeenAt));

  const staleIds = devices.slice(AUTH_SECURITY_LIMITS.maxTrustedDevices).map((row) => row.id);
  if (staleIds.length > 0) {
    await db.delete(userTrustedDevices).where(inArray(userTrustedDevices.id, staleIds));
  }
}

export async function revokeTrustedDevice(userId: string, fingerprintHash: string): Promise<void> {
  await db
    .delete(userTrustedDevices)
    .where(
      and(
        eq(userTrustedDevices.userId, userId),
        eq(userTrustedDevices.fingerprintHash, fingerprintHash)
      )
    );
}

export async function cleanupExpiredAuthArtifacts(): Promise<void> {
  const now = new Date();

  await Promise.all([
    db.delete(authEmailOtps).where(sql`${authEmailOtps.expiresAt} <= ${now}`),
    db.delete(userTrustedDevices).where(sql`${userTrustedDevices.trustedUntil} <= ${now}`),
  ]);
}
