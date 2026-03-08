// src/app/api/analytics/route.ts
// GET /api/analytics?range=30 — returns full analytics data

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { analyticsService } from "@/server/services/analytics.service";
import { achievementService } from "@/server/services/achievements.service";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const range = parseInt(searchParams.get("range") ?? "30", 10);

  try {
    const [momentum, categories, lifetime, achievements] = await Promise.all([
      analyticsService.getMomentumData(userId, range),
      analyticsService.getCategoryBreakdown(userId),
      analyticsService.getLifetimeStats(userId),
      achievementService.getAllWithStatus(userId),
    ]);

    return NextResponse.json({
      momentum,
      categories,
      lifetime,
      achievements,
    });
  } catch (err) {
    console.error("[GET /api/analytics]", err);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
