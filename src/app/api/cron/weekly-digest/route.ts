export const runtime = "edge";

import { NextResponse } from "next/server";
import { weeklyDigestService } from "@/server/services/weekly-digest.service";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await weeklyDigestService.runWeeklyDigestBatch(250);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/cron/weekly-digest]", err);
    return NextResponse.json({ error: "Failed to run weekly digest" }, { status: 500 });
  }
}

