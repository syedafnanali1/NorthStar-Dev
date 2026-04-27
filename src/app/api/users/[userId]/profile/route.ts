// src/app/api/users/[userId]/profile/route.ts
// Returns public profile data. Connected users see more detail.

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { users, circleConnections, goals, groupMembers, groups } from "@/drizzle/schema";
import { and, eq, or, desc, count } from "drizzle-orm";
import type { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId: targetId } = await params;

  try {
    const [targetUser] = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        image: users.image,
        age: users.age,
        location: users.location,
        jobTitle: users.jobTitle,
        countryRegion: users.countryRegion,
        momentumScore: users.momentumScore,
        currentStreak: users.currentStreak,
        totalGoalsCompleted: users.totalGoalsCompleted,
        northStarScore: users.northStarScore,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);

    if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Check connection status
    const [conn] = await db
      .select({ id: circleConnections.id, status: circleConnections.status, requesterId: circleConnections.requesterId })
      .from(circleConnections)
      .where(
        or(
          and(eq(circleConnections.requesterId, sessionUserId), eq(circleConnections.receiverId, targetId)),
          and(eq(circleConnections.requesterId, targetId), eq(circleConnections.receiverId, sessionUserId))
        )
      )
      .limit(1);

    const isConnected = conn?.status === "accepted";
    const connectionStatus = conn
      ? { id: conn.id, status: conn.status, direction: conn.requesterId === sessionUserId ? "sent" : "received" as "sent" | "received" }
      : null;

    // Public info always returned
    const publicProfile = {
      id: targetUser.id,
      name: targetUser.name,
      username: targetUser.username,
      image: targetUser.image,
      age: targetUser.age,
      location: targetUser.location,
      jobTitle: targetUser.jobTitle,
      countryRegion: targetUser.countryRegion,
      isConnected,
      connectionStatus,
    };

    if (!isConnected) {
      return NextResponse.json({ profile: publicProfile });
    }

    // Connected: also fetch goals and groups
    const [activeGoals, userGroups, circleCount] = await Promise.all([
      db
        .select({ id: goals.id, title: goals.title, emoji: goals.emoji, color: goals.color, currentValue: goals.currentValue, targetValue: goals.targetValue })
        .from(goals)
        .where(and(eq(goals.userId, targetId), eq(goals.isArchived, false)))
        .orderBy(desc(goals.updatedAt))
        .limit(5),

      db
        .select({ id: groups.id, name: groups.name, icon: groups.icon, memberCount: groups.memberCount })
        .from(groupMembers)
        .innerJoin(groups, eq(groupMembers.groupId, groups.id))
        .where(and(eq(groupMembers.userId, targetId), eq(groupMembers.status, "active")))
        .limit(5),

      db
        .select({ cnt: count() })
        .from(circleConnections)
        .where(
          and(
            eq(circleConnections.status, "accepted"),
            or(eq(circleConnections.requesterId, targetId), eq(circleConnections.receiverId, targetId))
          )
        )
        .then((rows) => rows[0]?.cnt ?? 0),
    ]);

    return NextResponse.json({
      profile: {
        ...publicProfile,
        momentumScore: targetUser.momentumScore,
        currentStreak: targetUser.currentStreak,
        totalGoalsCompleted: targetUser.totalGoalsCompleted,
        northStarScore: targetUser.northStarScore,
        circleCount,
        activeGoals,
        groups: userGroups,
        memberSince: targetUser.createdAt,
      },
    });
  } catch (err) {
    console.error("[GET /api/users/[userId]/profile]", err);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}
