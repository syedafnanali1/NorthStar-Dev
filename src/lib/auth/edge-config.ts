// src/lib/auth/edge-config.ts
// Edge-compatible NextAuth config used by:
//   1. src/middleware.ts — JWT verification on every request (no DB)
//   2. src/app/api/auth/[...nextauth]/route.ts — handles credentials login on Edge
//
// Intentionally minimal: no DrizzleAdapter, no email service, no step-up OTP.
// Uses neon HTTP directly so it runs in Vercel Edge Functions (25 s timeout).

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import Credentials from "next-auth/providers/credentials";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql as sqlTag } from "drizzle-orm";
import { users } from "@/drizzle/schema";

const edgeProviders = [
  Credentials({
    name: "Email",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = credentials?.email as string | undefined;
      const password = credentials?.password as string | undefined;
      if (!email || !password) return null;

      const connectionString = process.env["DATABASE_URL"];
      if (!connectionString) return null;

      try {
        const sqlClient = neon(connectionString);
        const db = drizzle(sqlClient);

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
          .where(sqlTag`lower(${users.email}) = ${email.trim().toLowerCase()}`)
          .limit(1);

        if (!user?.passwordHash || !user.emailVerified) return null;

        const { compare } = await import("bcryptjs");
        const isMatch = await compare(password, user.passwordHash);
        if (!isMatch) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
        };
      } catch {
        return null;
      }
    },
  }),
];

if (process.env["GOOGLE_CLIENT_ID"] && process.env["GOOGLE_CLIENT_SECRET"]) {
  edgeProviders.unshift(
    Google({
      clientId: process.env["GOOGLE_CLIENT_ID"],
      clientSecret: process.env["GOOGLE_CLIENT_SECRET"],
      allowDangerousEmailAccountLinking: true,
    }) as never
  );
}

if (process.env["FACEBOOK_CLIENT_ID"] && process.env["FACEBOOK_CLIENT_SECRET"]) {
  edgeProviders.unshift(
    Facebook({
      clientId: process.env["FACEBOOK_CLIENT_ID"],
      clientSecret: process.env["FACEBOOK_CLIENT_SECRET"],
      allowDangerousEmailAccountLinking: true,
    }) as never
  );
}

export const { handlers, auth: edgeAuth } = NextAuth({
  trustHost: true,
  secret: process.env["AUTH_SECRET"] ?? process.env["NEXTAUTH_SECRET"],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  providers: edgeProviders,
  callbacks: {
    async jwt({ token, user }) {
      if (user) token["userId"] = user.id;
      return token;
    },
    async session({ session, token }) {
      const userId = token["userId"] as string | undefined;
      if (userId) session.user.id = userId;
      return session;
    },
  },
});
