export const runtime = "edge";

// POST /api/circle/cheer — send a cheer notification to a circle member

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { notifications, users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

const schema = z.object({ targetId: z.string().min(1) });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: unknown = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "targetId required" }, { status: 422 });

  const { targetId } = parsed.data;
  if (targetId === userId) return NextResponse.json({ error: "Cannot cheer yourself" }, { status: 400 });

  const [sender] = await db
    .select({ name: users.name, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const senderName = sender?.name ?? sender?.username ?? "Someone in your circle";

  await db.insert(notifications).values({
    userId: targetId,
    type: "friend_activity",
    title: "Cheer from your circle! 🎉",
    body: `${senderName} cheered you on — keep going!`,
    link: "/circle",
    channel: "in_app",
    metadata: { senderId: userId, type: "cheer" },
  });

  return NextResponse.json({ ok: true });
}
