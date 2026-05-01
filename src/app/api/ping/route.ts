import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

// Edge runtime: 25 s timeout on Hobby plan (vs 10 s for serverless).
// This gives the Neon compute enough time to wake from cold suspension.
export const runtime = "edge";

export async function GET(): Promise<NextResponse> {
  try {
    const connectionString = process.env["DATABASE_URL"];
    if (!connectionString) return NextResponse.json({ ok: false }, { status: 503 });
    const sql = neon(connectionString);
    await sql`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
