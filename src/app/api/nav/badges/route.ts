export const runtime = "edge";

import { NextResponse } from "next/server";
import { and, count, eq, gt, lt, sql } from "drizzle-orm";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { notifications, groupInvites, goals } from "@/drizzle/schema";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const twoWeeksAhead = new Date(now.getTime() + 14 * 86_400_000);

  const [unreadNotifs, pendingGroupInvites, atRiskGoals] = await Promise.all([
    // Unread notifications
    db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false))),

    // Pending group invites
    db
      .select({ n: count() })
      .from(groupInvites)
      .where(and(eq(groupInvites.inviteeUserId, userId), eq(groupInvites.status, "pending"))),

    // At-risk goals: <40% progress and deadline within 2 weeks
    db
      .select({ n: count() })
      .from(goals)
      .where(
        and(
          eq(goals.userId, userId),
          eq(goals.isCompleted, false),
          eq(goals.isArchived, false),
          lt(goals.endDate, twoWeeksAhead),
          gt(goals.endDate, now),
          sql`COALESCE(${goals.currentValue}, 0) < COALESCE(${goals.targetValue}, 1) * 0.4`
        )
      ),
  ]);

  return NextResponse.json(
    {
      notifications: unreadNotifs[0]?.n ?? 0,
      groups: pendingGroupInvites[0]?.n ?? 0,
      goals: atRiskGoals[0]?.n ?? 0,
    },
    {
      headers: { "Cache-Control": "private, max-age=60" },
    }
  );
}
