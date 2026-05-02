export const runtime = "edge";

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupGoalsService } from "@/server/services/group-goals.service";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ groupGoalId: string; taskId: string }>;
}

export async function POST(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupGoalId, taskId } = await ctx.params;
  try {
    const tasks = await groupGoalsService.completeTask(groupGoalId, userId, taskId);
    return NextResponse.json({ tasks });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to complete task";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

