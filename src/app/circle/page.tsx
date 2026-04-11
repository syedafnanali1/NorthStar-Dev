// src/app/circle/page.tsx
import type { Metadata } from "next";
import { requireAuthUser } from "@/lib/auth/helpers";
import { AppLayout } from "@/components/layout/app-layout";
import { CircleFeed } from "./circle-feed";
import { InviteCircleButton } from "@/components/circle/invite-circle-button";
import { db } from "@/lib/db";
import { circleConnections, users, circlePosts, goals } from "@/drizzle/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { subDays } from "date-fns";

export const metadata: Metadata = { title: "Your Circle" };

export default async function CirclePage() {
  const user = await requireAuthUser();

  // Get connections
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

  // Get circle member details
  const circleMembers = circleIds.length > 0
    ? await db.select({
        id: users.id, name: users.name, username: users.username, image: users.image,
        streak: users.currentStreak, momentumScore: users.momentumScore,
      }).from(users).where(inArray(users.id, circleIds))
    : [];

  // Get user's goals for the post composer
  const userGoals = await db.select({ id: goals.id, title: goals.title, emoji: goals.emoji })
    .from(goals).where(and(eq(goals.userId, user.id), eq(goals.isArchived, false)));

  // Circle feed posts
  const allIds = [user.id, ...circleIds];
  const circlePosts_ = await db
    .select({
      post: circlePosts,
      author: {
        id: users.id,
        name: users.name,
        username: users.username,
        image: users.image,
        streak: users.currentStreak,
      },
      goalTitle: goals.title,
    })
    .from(circlePosts)
    .leftJoin(users, eq(circlePosts.userId, users.id))
    .leftJoin(goals, eq(circlePosts.goalId, goals.id))
    .where(inArray(circlePosts.userId, allIds))
    .orderBy(desc(circlePosts.createdAt))
    .limit(20);

  // Community feed
  const communityPosts = await db
    .select({
      post: circlePosts,
      author: {
        id: users.id,
        name: users.name,
        username: users.username,
        image: users.image,
        streak: users.currentStreak,
      },
      goalTitle: goals.title,
    })
    .from(circlePosts)
    .leftJoin(users, eq(circlePosts.userId, users.id))
    .leftJoin(goals, eq(circlePosts.goalId, goals.id))
    .where(eq(circlePosts.visibility, "community"))
    .orderBy(desc(circlePosts.createdAt))
    .limit(20);

  // Global leaderboard top 10
  const leaderboard = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      image: users.image,
      streak: users.currentStreak,
      score: users.momentumScore,
    })
    .from(users)
    .orderBy(desc(users.momentumScore))
    .limit(10);

  const weekAgo = subDays(new Date(), 7);
  const weeklyPosts = circlePosts_.filter((row) => row.post.createdAt >= weekAgo).length;
  const activeStreaks =
    (user.currentStreak > 0 ? 1 : 0) + circleMembers.filter((member) => member.streak > 0).length;
  const circleStats = {
    members: circleMembers.length + 1,
    weeklyPosts,
    activeStreaks,
    publicPosts: communityPosts.length,
  };

  return (
    <AppLayout rightPanelVariant="circle">
      <div className="mb-8 flex items-start justify-between gap-6 lg:mb-10">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted lg:desktop-kicker">
            Stay Accountable
          </p>
          <h1 className="mt-2 text-3xl font-serif text-ink sm:text-4xl lg:desktop-page-title">
            Your Circle
          </h1>
          <p className="mt-2 hidden text-[0.95rem] font-serif italic text-ink-muted lg:block">
            Share wins, support growth, stay consistent together.
          </p>
        </div>
        <div className="flex-shrink-0 pt-1">
          <InviteCircleButton />
        </div>
      </div>
      <CircleFeed
        currentUserId={user.id}
        circleMembers={circleMembers}
        userGoals={userGoals}
        circlePosts={circlePosts_.map((r) => ({ ...r.post, author: r.author, goalTitle: r.goalTitle }))}
        communityPosts={communityPosts.map((r) => ({ ...r.post, author: r.author, goalTitle: r.goalTitle }))}
        leaderboard={leaderboard}
        circleStats={circleStats}
      />
    </AppLayout>
  );
}
