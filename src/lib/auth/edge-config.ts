// src/lib/auth/edge-config.ts
// Minimal NextAuth config for Edge runtime (middleware).
// No DB adapter, no drizzle, no bcryptjs — JWT-only verification.
// The full config (with adapter + callbacks) lives in config.ts and runs
// in the serverless Node.js environment.

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import Credentials from "next-auth/providers/credentials";

const edgeProviders = [
  Credentials({ name: "Email", credentials: {} }),
];

if (process.env["GOOGLE_CLIENT_ID"] && process.env["GOOGLE_CLIENT_SECRET"]) {
  edgeProviders.unshift(
    Google({
      clientId: process.env["GOOGLE_CLIENT_ID"],
      clientSecret: process.env["GOOGLE_CLIENT_SECRET"],
    }) as never
  );
}

if (process.env["FACEBOOK_CLIENT_ID"] && process.env["FACEBOOK_CLIENT_SECRET"]) {
  edgeProviders.unshift(
    Facebook({
      clientId: process.env["FACEBOOK_CLIENT_ID"],
      clientSecret: process.env["FACEBOOK_CLIENT_SECRET"],
    }) as never
  );
}

export const { auth: edgeAuth } = NextAuth({
  trustHost: true,
  secret: process.env["AUTH_SECRET"] ?? process.env["NEXTAUTH_SECRET"],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  providers: edgeProviders,
  callbacks: {
    jwt({ token, user }) {
      if (user) token["userId"] = user.id;
      return token;
    },
    session({ session, token }) {
      const userId = token["userId"] as string | undefined;
      if (userId) session.user.id = userId;
      return session;
    },
  },
});
