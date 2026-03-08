// src/middleware.ts
// Protect all app routes — redirect to login if not authenticated

export { auth as middleware } from "@/lib/auth/config";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/goals/:path*",
    "/calendar/:path*",
    "/analytics/:path*",
    "/circle/:path*",
    "/profile/:path*",
  ],
};
