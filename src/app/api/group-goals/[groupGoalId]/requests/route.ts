export const runtime = "edge";

// src/app/api/group-goals/[groupGoalId]/requests/route.ts
// GET   /api/group-goals/:id/requests — list pending join requests (owner only)
// PATCH /api/group-goals/:id/requests — approve/reject request (owner only)

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupGoalsService } from "@/server/services/group-goals.service";
import { xpService } from "@/server/services/xp.service";
import type { NextRequest } from "next/server";

const reviewSchema = z.object({
  requestId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
});

interface RouteContext {
  params: Promise<{ groupGoalId: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupGoalId } = await ctx.params;
  try {
    const requests = await groupGoalsService.getPendingJoinRequests(groupGoalId, userId);
    return NextResponse.json({ requests });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch join requests";
    return NextResponse.json({ error: msg }, { status: 403 });
  }
}

export async function PATCH(request: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupGoalId } = await ctx.params;
  try {
    const body: unknown = await request.json();
    const validated = reviewSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 422 }
      );
    }

    const updated = await groupGoalsService.reviewJoinRequest(
      groupGoalId,
      userId,
      validated.data.requestId,
      validated.data.action
    );

    if (validated.data.action === "approve") {
      void xpService.awardXP(updated.requester.id, "join_group_goal");
    }

    return NextResponse.json({ request: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to review request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
