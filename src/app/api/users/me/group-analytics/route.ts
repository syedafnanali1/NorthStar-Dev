// src/app/api/users/me/group-analytics/route.ts
// GET /api/users/me/group-analytics — per-group engagement stats + nudges for the current user.

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupEngagementService } from "@/server/services/group-engagement.service";
import type { NextRequest } from "next/server";

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [stats, nudges, badges] = await Promise.all([
      groupEngagementService.getUserGroupAnalytics(userId),
      groupEngagementService.getNudges(userId),
      groupEngagementService.getUserGroupBadges(userId),
    ]);

    return NextResponse.json({ stats, nudges, badges });
  } catch (err) {
    console.error("[GET /api/users/me/group-analytics]", err);
    return NextResponse.json({ error: "Failed to load group analytics" }, { status: 500 });
  }
}
