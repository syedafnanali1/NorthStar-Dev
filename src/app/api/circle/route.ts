// src/app/api/circle/route.ts
// GET  /api/circle?feed=circle|community — get feed posts
// POST /api/circle — create a post

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import {
  circlePosts,
  users,
  circleConnections,
  goals,
} from "@/drizzle/schema";
import { eq, and, or, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import type { NextRequest } from "next/server";

const createPostSchema = z.object({
  text: z.string().min(1).max(500),
  goalId: z.string().optional().nullable(),
  visibility: z.enum(["circle", "community"]).default("circle"),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const feed = searchParams.get("feed") ?? "circle";

  try {
    let posts;

    if (feed === "community") {
      // Community feed: all public posts
      posts = await db
        .select({
          post: circlePosts,
          author: {
            id: users.id,
            name: users.name,
            image: users.image,
            currentStreak: users.currentStreak,
          },
          goalTitle: goals.title,
          goalCategory: goals.category,
        })
        .from(circlePosts)
        .leftJoin(users, eq(circlePosts.userId, users.id))
        .leftJoin(goals, eq(circlePosts.goalId, goals.id))
        .where(eq(circlePosts.visibility, "community"))
        .orderBy(desc(circlePosts.createdAt))
        .limit(30);
    } else {
      // Circle feed: posts from connections
      const connections = await db
        .select({
          otherId: circleConnections.requesterId,
        })
        .from(circleConnections)
        .where(
          and(
            eq(circleConnections.receiverId, userId),
            eq(circleConnections.status, "accepted")
          )
        );

      const connections2 = await db
        .select({ otherId: circleConnections.receiverId })
        .from(circleConnections)
        .where(
          and(
            eq(circleConnections.requesterId, userId),
            eq(circleConnections.status, "accepted")
          )
        );

      const circleIds = [
        userId,
        ...connections.map((c) => c.otherId),
        ...connections2.map((c) => c.otherId),
      ];

      posts = await db
        .select({
          post: circlePosts,
          author: {
            id: users.id,
            name: users.name,
            image: users.image,
            currentStreak: users.currentStreak,
          },
          goalTitle: goals.title,
          goalCategory: goals.category,
        })
        .from(circlePosts)
        .leftJoin(users, eq(circlePosts.userId, users.id))
        .leftJoin(goals, eq(circlePosts.goalId, goals.id))
        .where(inArray(circlePosts.userId, circleIds))
        .orderBy(desc(circlePosts.createdAt))
        .limit(30);
    }

    return NextResponse.json({ posts });
  } catch (err) {
    console.error("[GET /api/circle]", err);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    const validated = createPostSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 422 }
      );
    }

    const [post] = await db
      .insert(circlePosts)
      .values({
        userId,
        text: validated.data.text,
        goalId: validated.data.goalId ?? null,
        visibility: validated.data.visibility,
      })
      .returning();

    return NextResponse.json({ post }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/circle]", err);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
