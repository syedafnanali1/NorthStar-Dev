// src/middleware.ts
// Protect app routes and redirect unauthenticated users to /auth/login.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";

export default auth((req) => {
  if (req.auth?.user?.id) {
    return NextResponse.next();
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/auth/login";
  loginUrl.searchParams.set("from", req.nextUrl.pathname);
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
