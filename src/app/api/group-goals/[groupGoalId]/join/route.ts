export const runtime = "edge";

// src/app/api/group-goals/[groupGoalId]/join/route.ts
// POST /api/group-goals/:id/join — request to join a group

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupGoalsService } from "@/server/services/group-goals.service";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ groupGoalId: string }>;
}

export async function POST(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupGoalId } = await ctx.params;
  try {
    const body = (await _req.json().catch(() => ({}))) as { note?: string };
    await groupGoalsService.joinGroup(groupGoalId, userId, body.note);
    return NextResponse.json({ success: true, status: "pending" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to send join request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
