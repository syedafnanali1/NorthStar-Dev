// src/middleware.ts
// Protect app routes and redirect unauthenticated users to /auth/login.
// Uses a lightweight Edge-compatible NextAuth config to avoid bundling
// drizzle/bcrypt in the Edge runtime.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { edgeAuth } from "@/lib/auth/edge-config";

export default edgeAuth(function middleware(req: NextRequest & { auth: unknown }) {
  if (req.auth) {
    return NextResponse.next();
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/auth/login";
  loginUrl.searchParams.set("from", `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/goals/:path*",
    "/calendar/:path*",
    "/analytics/:path*",
    "/circle/:path*",
    "/profile/:path*",
    "/onboarding/:path*",
    "/onboarding",
  ],
};
