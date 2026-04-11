// src/middleware.ts
// Protect app routes and redirect unauthenticated users to /auth/login.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

function isSecureRequest(req: NextRequest) {
  return req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
}

export default async function middleware(req: NextRequest) {
  const secureCookie = isSecureRequest(req);
  const token = await getToken({
    req,
    secret: process.env["AUTH_SECRET"] ?? process.env["NEXTAUTH_SECRET"],
    secureCookie,
  });

  if (token) {
    return NextResponse.next();
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/auth/login";
  loginUrl.searchParams.set("from", `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

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
