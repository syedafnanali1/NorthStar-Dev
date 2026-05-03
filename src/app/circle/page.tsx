// src/app/circle/page.tsx
import type { Metadata } from "next";
import { requireAuthUser } from "@/lib/auth/helpers";
import { AppLayout } from "@/components/layout/app-layout";
import { CircleFeed } from "./circle-feed";
import { db } from "@/lib/db";
import { circleConnections, users, goals, dailyLogs } from "@/drizzle/schema";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { format } from "date-fns";
import { friendsService } from "@/server/services/friends.service";

export const metadata: Metadata = { title: "Your Circle" };

export default async function CirclePage() {
  const user = await requireAuthUser();

  const [sent, received] = await Promise.all([
    db.select({ otherId: circleConnections.receiverId, status: circleConnections.status })
      .from(circleConnections).where(eq(circleConnections.requesterId, user.id)),
    db.select({ otherId: circleConnections.requesterId, status: circleConnections.status })
      .from(circleConnections).where(eq(circleConnections.receiverId, user.id)),
  ]);

  const circleIds = [
    ...sent.filter((c) => c.status === "accepted").map((c) => c.otherId),
    ...received.filter((c) => c.status === "accepted").map((c) => c.otherId),
  ];

  const today = format(new Date(), "yyyy-MM-dd");

  const [circleMembers, userGoals, pendingRequests, memberLogs, todayLogs, suggestions] = await Promise.all([
    circleIds.length > 0
      ? db.select({
          id: users.id, name: users.name, username: users.username, image: users.image,
          streak: users.currentStreak, momentumScore: users.momentumScore,
          totalGoalsCompleted: users.totalGoalsCompleted,
          jobTitle: users.jobTitle, location: users.location,
        }).from(users).where(inArray(users.id, circleIds))
      : [],

    db.select({ id: goals.id, title: goals.title, emoji: goals.emoji, color: goals.color, isPublic: goals.isPublic })
      .from(goals).where(and(eq(goals.userId, user.id), eq(goals.isArchived, false))),

    friendsService.getPendingRequests(user.id),

    // Most recent daily log per member (for last activity)
    circleIds.length > 0
      ? db.select({ userId: dailyLogs.userId, date: dailyLogs.date, mood: dailyLogs.mood, completedTaskIds: dailyLogs.completedTaskIds })
          .from(dailyLogs)
          .where(inArray(dailyLogs.userId, circleIds))
          .orderBy(desc(dailyLogs.date))
      : [],

    // Today's logs for each member (checked-in today)
    circleIds.length > 0
      ? db.select({ userId: dailyLogs.userId })
          .from(dailyLogs)
          .where(and(inArray(dailyLogs.userId, circleIds), eq(dailyLogs.date, today)))
      : [],

    // People you may know: users not in circle (excluding self), ordered by momentum
    db.select({
        id: users.id, name: users.name, username: users.username, image: users.image,
        streak: users.currentStreak, momentumScore: users.momentumScore,
        totalGoalsCompleted: users.totalGoalsCompleted,
      })
      .from(users)
      .where(
        and(
          or(
            eq(users.id, users.id), // always true — we filter in JS
          )
        )
      )
      .orderBy(desc(users.momentumScore))
      .limit(30),
  ]);

  // Build per-member last log map (most recent date)
  const lastLogByUser = new Map<string, { date: string; mood: string | null; completedTaskIds: string[] }>();
  for (const log of memberLogs) {
    if (!lastLogByUser.has(log.userId)) {
      lastLogByUser.set(log.userId, { date: log.date, mood: log.mood, completedTaskIds: log.completedTaskIds });
    }
  }

  const checkedInTodayIds = new Set(todayLogs.map((l) => l.userId));
  const activeToday = checkedInTodayIds.size;

  // Filter suggestions: exclude self + existing circle members + pending
  const circleAndPendingIds = new Set([user.id, ...circleIds]);
  const suggestedPeople = suggestions
    .filter((u) => !circleAndPendingIds.has(u.id))
    .slice(0, 5);

  return (
    <AppLayout rightPanelVariant="circle">
      <CircleFeed
        currentUserId={user.id}
        currentUserName={user.name ?? user.username ?? "You"}
        circleMembers={circleMembers.map((m) => ({
          id: m.id, name: m.name, username: m.username, image: m.image,
          streak: m.streak, momentumScore: m.momentumScore,
          totalGoalsCompleted: m.totalGoalsCompleted,
          jobTitle: m.jobTitle, location: m.location,
          checkedInToday: checkedInTodayIds.has(m.id),
          lastLog: lastLogByUser.get(m.id) ?? null,
        }))}
        userGoals={userGoals}
        pendingRequests={pendingRequests.map((r) => ({
          connectionId: r.connectionId,
          direction: r.direction,
          createdAt: r.createdAt,
          user: r.user,
        }))}
        suggestedPeople={suggestedPeople}
        activeToday={activeToday}
      />
    </AppLayout>
  );
}
