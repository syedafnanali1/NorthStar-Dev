export const runtime = "edge";

// src/app/api/cron/streak-alerts/route.ts
// Runs as a re-engagement job and sends adaptive streak-risk alerts.

import { NextResponse } from "next/server";
import { reengagementService } from "@/server/services/reengagement.service";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await reengagementService.runAdaptiveStreakRiskBatch(320);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/cron/streak-alerts]", err);
    return NextResponse.json(
      { error: "Failed to run streak-risk notifications" },
      { status: 500 }
    );
  }
}

