// src/lib/auth/config.ts
// NextAuth v5 configuration
// Google OAuth, Facebook OAuth, email/password credentials

import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { loginSchema } from "@/lib/validators/auth";
import {
  isFacebookOAuthConfigured,
  isGoogleOAuthConfigured,
} from "@/lib/env-checks";

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
    async authorize(credentials) {
      const validated = loginSchema.safeParse(credentials);
      if (!validated.success) return null;

      const { email, password } = validated.data;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user || !user.passwordHash) return null;

      const passwordMatch = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatch) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      };
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
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
    verifyRequest: "/auth/verify-email",
  },

  providers,

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token["userId"] = user.id;
      }

      // Handle session updates (e.g., profile changes)
      if (trigger === "update" && session) {
        token["name"] = session.name as string;
        token["image"] = session.image as string;
      }

      return token;
    },

    async session({ session, token }) {
      if (token["userId"]) {
        session.user.id = token["userId"] as string;
      }
      return session;
    },
  },

  events: {
    async signIn({ user }) {
      // Update lastActiveAt on sign in
      if (user.id) {
        await db
          .update(users)
          .set({ lastActiveAt: new Date() })
          .where(eq(users.id, user.id));
      }
    },
  },

  debug: process.env["NODE_ENV"] === "development",
});
