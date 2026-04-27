// src/app/circle/page.tsx
import type { Metadata } from "next";
import { requireAuthUser } from "@/lib/auth/helpers";
import { AppLayout } from "@/components/layout/app-layout";
import { CircleFeed } from "./circle-feed";
import { db } from "@/lib/db";
import { circleConnections, users, circlePosts, goals } from "@/drizzle/schema";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { subDays } from "date-fns";
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

  // Fetch all data in parallel
  const [circleMembers, userGoals, pendingRequests] = await Promise.all([
    circleIds.length > 0
      ? db.select({
          id: users.id, name: users.name, username: users.username, image: users.image,
          streak: users.currentStreak, momentumScore: users.momentumScore,
          jobTitle: users.jobTitle, location: users.location,
        }).from(users).where(inArray(users.id, circleIds))
      : [],

    db.select({ id: goals.id, title: goals.title, emoji: goals.emoji })
      .from(goals).where(and(eq(goals.userId, user.id), eq(goals.isArchived, false))),

    friendsService.getPendingRequests(user.id),
  ]);

  const allIds = [user.id, ...circleIds];

  const [circlePosts_, communityPosts, leaderboard] = await Promise.all([
    db.select({
        post: circlePosts,
        author: { id: users.id, name: users.name, username: users.username, image: users.image, streak: users.currentStreak },
        goalTitle: goals.title,
      })
      .from(circlePosts)
      .leftJoin(users, eq(circlePosts.userId, users.id))
      .leftJoin(goals, eq(circlePosts.goalId, goals.id))
      .where(inArray(circlePosts.userId, allIds))
      .orderBy(desc(circlePosts.createdAt))
      .limit(20),

    db.select({
        post: circlePosts,
        author: { id: users.id, name: users.name, username: users.username, image: users.image, streak: users.currentStreak },
        goalTitle: goals.title,
      })
      .from(circlePosts)
      .leftJoin(users, eq(circlePosts.userId, users.id))
      .leftJoin(goals, eq(circlePosts.goalId, goals.id))
      .where(eq(circlePosts.visibility, "community"))
      .orderBy(desc(circlePosts.createdAt))
      .limit(20),

    // Leaderboard: combined score = momentumScore + streak * 2 + totalGoalsCompleted * 5
    db.select({
        id: users.id, name: users.name, username: users.username, image: users.image,
        streak: users.currentStreak, momentumScore: users.momentumScore,
        totalGoalsCompleted: users.totalGoalsCompleted,
        leaderboardScore: sql<number>`(${users.momentumScore} + ${users.currentStreak} * 2 + ${users.totalGoalsCompleted} * 5)`,
      })
      .from(users)
      .orderBy(desc(sql`(${users.momentumScore} + ${users.currentStreak} * 2 + ${users.totalGoalsCompleted} * 5)`))
      .limit(10),
  ]);

  const weekAgo = subDays(new Date(), 7);
  const weeklyPosts = circlePosts_.filter((r) => r.post.createdAt >= weekAgo).length;
  const activeStreaks =
    (user.currentStreak > 0 ? 1 : 0) + circleMembers.filter((m) => m.streak > 0).length;

  const circleStats = {
    members: circleMembers.length + 1,
    weeklyPosts,
    activeStreaks,
    publicPosts: communityPosts.length,
  };

  return (
    <AppLayout rightPanelVariant="circle">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
            Stay Accountable
          </p>
          <h1 className="mt-2 font-serif text-3xl text-ink sm:text-4xl">Your Circle</h1>
          <p className="mt-1 hidden text-sm italic text-ink-muted lg:block">
            Share wins, support growth, stay consistent together.
          </p>
        </div>
      </div>

      <CircleFeed
        currentUserId={user.id}
        currentUserName={user.name ?? user.username ?? "You"}
        circleMembers={circleMembers.map((m) => ({
          id: m.id, name: m.name, username: m.username, image: m.image,
          streak: m.streak, momentumScore: m.momentumScore,
          jobTitle: m.jobTitle, location: m.location,
        }))}
        userGoals={userGoals}
        circlePosts={circlePosts_.map((r) => ({ ...r.post, author: r.author, goalTitle: r.goalTitle }))}
        communityPosts={communityPosts.map((r) => ({ ...r.post, author: r.author, goalTitle: r.goalTitle }))}
        leaderboard={leaderboard.map((u) => ({
          id: u.id, name: u.name, username: u.username, image: u.image,
          streak: u.streak, score: u.leaderboardScore,
        }))}
        circleStats={circleStats}
        pendingRequests={pendingRequests.map((r) => ({
          connectionId: r.connectionId,
          direction: r.direction,
          createdAt: r.createdAt,
          user: r.user,
        }))}
      />
    </AppLayout>
  );
}
