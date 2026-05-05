export const runtime = "edge";

// GET /api/groups/[id]/activity
// Returns a chronological activity feed for the group:
//   - Recent goal check-ins by members
//   - Recent member joins

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import {
  groupGoalCheckIns,
  groupGoalItems,
  groupMembers,
  users,
} from "@/drizzle/schema";
import { and, desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await ctx.params;

  // Fetch recent check-ins (last 30)
  const checkIns = await db
    .select({
      userId: groupGoalCheckIns.userId,
      userName: users.name,
      userImage: users.image,
      goalName: groupGoalItems.title,
      note: groupGoalCheckIns.note,
      value: groupGoalCheckIns.value,
      loggedAt: groupGoalCheckIns.loggedAt,
    })
    .from(groupGoalCheckIns)
    .innerJoin(groupGoalItems, eq(groupGoalCheckIns.groupGoalItemId, groupGoalItems.id))
    .innerJoin(users, eq(groupGoalCheckIns.userId, users.id))
    .where(eq(groupGoalItems.groupId, groupId))
    .orderBy(desc(groupGoalCheckIns.loggedAt))
    .limit(30);

  // Fetch recent joins (last 10)
  const joins = await db
    .select({
      userId: groupMembers.userId,
      userName: users.name,
      userImage: users.image,
      joinedAt: groupMembers.joinedAt,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "active")))
    .orderBy(desc(groupMembers.joinedAt))
    .limit(10);

  // Merge and sort
  type ActivityItem = {
    type: "checkin" | "joined";
    userId: string;
    userName: string | null;
    userImage: string | null;
    goalName?: string;
    note?: string | null;
    value?: number;
    loggedAt: string;
  };

  const items: ActivityItem[] = [
    ...checkIns.map((c) => ({
      type: "checkin" as const,
      userId: c.userId,
      userName: c.userName,
      userImage: c.userImage,
      goalName: c.goalName,
      note: c.note,
      value: c.value ?? undefined,
      loggedAt: c.loggedAt.toISOString(),
    })),
    ...joins.map((j) => ({
      type: "joined" as const,
      userId: j.userId,
      userName: j.userName,
      userImage: j.userImage,
      loggedAt: j.joinedAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime())
    .slice(0, 30);

  return NextResponse.json({ items });
}
