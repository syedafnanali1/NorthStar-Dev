import { NextResponse } from "next/server";
import {
  isDatabaseConfigured,
  isFacebookOAuthConfigured,
  isGoogleOAuthConfigured,
} from "@/lib/env-checks";

export async function GET(): Promise<NextResponse> {
  const databaseConfigured = isDatabaseConfigured(process.env["DATABASE_URL"]);
  const googleConfigured = isGoogleOAuthConfigured(
    process.env["GOOGLE_CLIENT_ID"],
    process.env["GOOGLE_CLIENT_SECRET"]
  );
  const facebookConfigured = isFacebookOAuthConfigured(
    process.env["FACEBOOK_CLIENT_ID"],
    process.env["FACEBOOK_CLIENT_SECRET"]
  );

  return NextResponse.json({
    databaseConfigured,
    googleConfigured,
    facebookConfigured,
  });
}

