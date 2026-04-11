import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";
import { and, eq, gt, sql } from "drizzle-orm";

import { accounts, sessions, users, verificationTokens } from "@/drizzle/schema";
import {
  clearFailedLogins,
  isUserLocked,
  normalizeEmail,
  recordFailedLogin,
} from "@/lib/auth/security-core";
import { createOtpChallenge } from "@/lib/auth/security";
import { db } from "@/lib/db";
import { authEmailService } from "@/lib/email/auth";
import {
  isFacebookOAuthConfigured,
  isGoogleOAuthConfigured,
} from "@/lib/env-checks";
import { loginSchema } from "@/lib/validators/auth";

const googleConfigured = isGoogleOAuthConfigured(
  process.env["GOOGLE_CLIENT_ID"],
  process.env["GOOGLE_CLIENT_SECRET"]
);

const facebookConfigured = isFacebookOAuthConfigured(
  process.env["FACEBOOK_CLIENT_ID"],
  process.env["FACEBOOK_CLIENT_SECRET"]
);

if (!googleConfigured) {
  console.warn("[auth] Google OAuth is not configured. Google sign-in is disabled.");
}

if (!facebookConfigured) {
  console.warn("[auth] Facebook OAuth is not configured. Facebook sign-in is disabled.");
}

const providers = [
  Credentials({
    name: "Email",
    credentials: {
      email: { label: "Email", type: "email", placeholder: "you@example.com" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const validated = loginSchema.safeParse(credentials);
      if (!validated.success) return null;

      const normalizedEmail = normalizeEmail(validated.data.email);
      const password = validated.data.password;

      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
          passwordHash: users.passwordHash,
          emailVerified: users.emailVerified,
        })
        .from(users)
        .where(sql`lower(${users.email}) = ${normalizedEmail}`)
        .limit(1);

      if (!user || !user.passwordHash) return null;

      const lockState = await isUserLocked(user.id);
      if (lockState.locked) {
        return null;
      }

      const { compare } = await import("bcryptjs");
      const passwordMatch = await compare(password, user.passwordHash);

      if (!passwordMatch) {
        await recordFailedLogin(user.id);
        return null;
      }

      if (!user.emailVerified) {
        return null;
      }

      await clearFailedLogins(user.id);

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      } as const;
    },
  }),
];

if (googleConfigured) {
  providers.unshift(
    Google({
      clientId: process.env["GOOGLE_CLIENT_ID"] ?? "",
      clientSecret: process.env["GOOGLE_CLIENT_SECRET"] ?? "",
      allowDangerousEmailAccountLinking: true,
    }) as never
  );
}

if (facebookConfigured) {
  providers.unshift(
    Facebook({
      clientId: process.env["FACEBOOK_CLIENT_ID"] ?? "",
      clientSecret: process.env["FACEBOOK_CLIENT_SECRET"] ?? "",
      allowDangerousEmailAccountLinking: true,
    }) as never
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(
    db,
    {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    } as unknown as never
  ),

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },

  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
    verifyRequest: "/auth/verify-email",
  },

  providers,

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" && account?.provider !== "facebook") {
        return true;
      }

      if (!user.id || !user.email) {
        return false;
      }

      const now = new Date();

      const [profile] = await db
        .select({ lastActiveAt: users.lastActiveAt })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);

      const [stepUpMarker] = await db
        .select({ token: verificationTokens.token })
        .from(verificationTokens)
        .where(
          and(
            eq(verificationTokens.identifier, `stepup_passed:${user.id}`),
            gt(verificationTokens.expires, now)
          )
        )
        .limit(1);

      const markerMs = Number(stepUpMarker?.token ?? 0);
      const lastVerifiedAt =
        Number.isFinite(markerMs) && markerMs > 0 ? new Date(markerMs) : null;
      const verifiedToday =
        !!lastVerifiedAt && lastVerifiedAt.toDateString() === now.toDateString();

      const firstLoginToday =
        !profile?.lastActiveAt ||
        profile.lastActiveAt.toDateString() !== now.toDateString();

      const daysSinceStepUp = lastVerifiedAt
        ? (now.getTime() - lastVerifiedAt.getTime()) / (1000 * 60 * 60 * 24)
        : Number.POSITIVE_INFINITY;

      const requiresStepUp =
        (!verifiedToday && firstLoginToday) || daysSinceStepUp > 7;

      if (!requiresStepUp) {
        return true;
      }

      const provider = account.provider === "google" || account.provider === "facebook"
        ? account.provider
        : "google";

      const verifyPath = `/auth/verify-email?mode=signin&provider=${encodeURIComponent(provider)}&email=${encodeURIComponent(user.email)}`;
      const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";

      try {
        const otpChallenge = await createOtpChallenge({
          userId: user.id,
          email: user.email,
          purpose: "signin_step_up",
          context: {
            provider,
            firstLoginToday,
            verifiedToday,
            daysSinceStepUp,
          },
          force: true,
        });

        if (otpChallenge.status === "created" && otpChallenge.otp) {
          const verifyUrl = `${appUrl}${verifyPath}&code=${encodeURIComponent(otpChallenge.otp)}`;
          await authEmailService.sendSignInStepUpOtp({
            to: user.email,
            otp: otpChallenge.otp,
            verifyUrl,
            device: `${provider} OAuth`,
            location: "Unknown location",
            timestamp: now.toISOString(),
          });
        }
      } catch (error) {
        console.error("[auth] oauth step-up otp send failed", error);
      }

      return verifyPath;
    },

    async jwt({ token, user, trigger, session }) {
      if (user) {
        token["userId"] = user.id;
      }

      if (trigger === "update" && session) {
        token["name"] = session.name as string;
        token["image"] = session.image as string;
      }

      return token;
    },

    async session({ session, token }) {
      const userId = token["userId"] as string | undefined;
      if (userId) {
        session.user.id = userId;
      }
      return session;
    },
  },

  events: {
    async signIn({ user }) {
      if (!user.id) return;

      await Promise.all([
        db
          .update(users)
          .set({ lastActiveAt: new Date() })
          .where(eq(users.id, user.id)),
        clearFailedLogins(user.id),
      ]);
    },
  },

  debug: process.env["NODE_ENV"] === "development",
});
