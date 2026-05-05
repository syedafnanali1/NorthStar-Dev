export const runtime = "edge";

// GET /api/groups/[id]/member-checkins?userId=<uid>
// Returns a member's recent check-in history for group goals in this group.

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { groupGoalCheckIns, groupGoalItems, users } from "@/drizzle/schema";
import { and, eq, desc } from "drizzle-orm";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await ctx.params;
  const targetUserId = req.nextUrl.searchParams.get("userId") ?? sessionUserId;

  const rows = await db
    .select({
      goalName: groupGoalItems.title,
      loggedAt: groupGoalCheckIns.loggedAt,
      note: groupGoalCheckIns.note,
      value: groupGoalCheckIns.value,
    })
    .from(groupGoalCheckIns)
    .innerJoin(groupGoalItems, eq(groupGoalCheckIns.groupGoalItemId, groupGoalItems.id))
    .where(
      and(
        eq(groupGoalItems.groupId, groupId),
        eq(groupGoalCheckIns.userId, targetUserId)
      )
    )
    .orderBy(desc(groupGoalCheckIns.loggedAt))
    .limit(20);

  return NextResponse.json({
    checkIns: rows.map((r) => ({
      goalName: r.goalName,
      loggedAt: r.loggedAt.toISOString(),
      note: r.note,
      value: r.value,
    })),
  });
}
