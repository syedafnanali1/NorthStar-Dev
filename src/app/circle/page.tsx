// src/app/circle/page.tsx
import type { Metadata } from "next";
import { requireAuthUser } from "@/lib/auth/helpers";
import { AppLayout } from "@/components/layout/app-layout";
import { CircleFeed } from "./circle-feed";
import { db } from "@/lib/db";
import { circleConnections, users, circlePosts, goals } from "@/drizzle/schema";
import { eq, and, desc, inArray, or } from "drizzle-orm";

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
        id: users.id, name: users.name, image: users.image,
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
      author: { id: users.id, name: users.name, image: users.image, streak: users.currentStreak },
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
      author: { id: users.id, name: users.name, image: users.image, streak: users.currentStreak },
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
    .select({ id: users.id, name: users.name, image: users.image, streak: users.currentStreak, score: users.momentumScore })
    .from(users)
    .orderBy(desc(users.momentumScore))
    .limit(10);

  return (
    <AppLayout>
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-2xs uppercase tracking-widest text-ink-muted mb-1">Stay Accountable</p>
          <h1 className="text-3xl font-serif text-ink">Your Circle</h1>
        </div>
        <InviteButton />
      </div>
      <CircleFeed
        currentUserId={user.id}
        circleMembers={circleMembers}
        userGoals={userGoals}
        circlePosts={circlePosts_.map((r) => ({ ...r.post, author: r.author, goalTitle: r.goalTitle }))}
        communityPosts={communityPosts.map((r) => ({ ...r.post, author: r.author, goalTitle: r.goalTitle }))}
        leaderboard={leaderboard}
      />
    </AppLayout>
  );
}

function InviteButton() {
  return (
    <a href="/profile#invite" className="btn-secondary flex items-center gap-2">
      <span>+</span> Invite
    </a>
  );
}
