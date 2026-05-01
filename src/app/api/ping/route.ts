import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Lightweight wake-up endpoint. Called by the login page on mount to warm
// the Neon DB and the serverless function runtime before the user clicks login.
export async function GET(): Promise<NextResponse> {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
