export const runtime = "edge";

// POST /api/circle/nudge — send a nudge notification (rate-limited: 1 per target per sender per day)

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { notifications, users } from "@/drizzle/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";

const schema = z.object({ targetId: z.string().min(1) });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: unknown = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "targetId required" }, { status: 422 });

  const { targetId } = parsed.data;
  if (targetId === userId) return NextResponse.json({ error: "Cannot nudge yourself" }, { status: 400 });

  // Rate limit: 1 nudge per sender→target per calendar day
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [existing] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, targetId),
        eq(notifications.type, "friend_activity"),
        gte(notifications.createdAt, startOfToday),
        sql`${notifications.metadata}->>'senderId' = ${userId}`,
        sql`${notifications.metadata}->>'type' = 'nudge'`
      )
    )
    .limit(1);

  if (existing) {
    return NextResponse.json({ alreadyNudged: true }, { status: 200 });
  }

  const [sender] = await db
    .select({ name: users.name, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const senderName = sender?.name ?? sender?.username ?? "Someone in your circle";

  await db.insert(notifications).values({
    userId: targetId,
    type: "friend_activity",
    title: "Time to check in! 🔔",
    body: `${senderName} thinks it's time to log your progress. You've got this!`,
    link: "/calendar",
    channel: "in_app",
    metadata: { senderId: userId, type: "nudge" },
  });

  return NextResponse.json({ ok: true });
}
