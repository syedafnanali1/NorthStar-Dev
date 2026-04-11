// src/app/api/users/[username]/route.ts
// GET public profile by username

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, goals, circleConnections } from "@/drizzle/schema";
import { eq, and, or } from "drizzle-orm";
import { achievementService } from "@/server/services/achievements.service";
import { analyticsService } from "@/server/services/analytics.service";
import { getSessionUserId } from "@/lib/auth/helpers";
import type { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
): Promise<NextResponse> {
  const { username } = await params;

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      image: users.image,
      level: users.level,
      xpPoints: users.xpPoints,
      northStarScore: users.northStarScore,
      currentStreak: users.currentStreak,
      longestStreak: users.longestStreak,
      totalGoalsCompleted: users.totalGoalsCompleted,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const viewerId = await getSessionUserId();

  const publicGoals = await db
    .select({
      id: goals.id,
      title: goals.title,
      emoji: goals.emoji,
      color: goals.color,
      category: goals.category,
      currentValue: goals.currentValue,
      targetValue: goals.targetValue,
      unit: goals.unit,
      isCompleted: goals.isCompleted,
    })
    .from(goals)
    .where(and(eq(goals.userId, user.id), eq(goals.isArchived, false)));

  const [achievements, constellation, connection] = await Promise.all([
    achievementService.getAllWithStatus(user.id),
    analyticsService.getActivityGrid(user.id),
    viewerId && viewerId !== user.id
      ? db
          .select({
            requesterId: circleConnections.requesterId,
            receiverId: circleConnections.receiverId,
            status: circleConnections.status,
          })
          .from(circleConnections)
          .where(
            or(
              and(
                eq(circleConnections.requesterId, viewerId),
                eq(circleConnections.receiverId, user.id)
              ),
              and(
                eq(circleConnections.requesterId, user.id),
                eq(circleConnections.receiverId, viewerId)
              )
            )
          )
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);

  const friendStatus =
    !viewerId || viewerId === user.id
      ? "self"
      : connection?.status === "accepted"
      ? "friends"
      : connection?.status === "pending"
      ? connection.requesterId === viewerId
        ? "outgoing_pending"
        : "incoming_pending"
      : "none";

  return NextResponse.json({
    user,
    goals: publicGoals,
    achievements,
    constellation,
    friendStatus,
  });
}
