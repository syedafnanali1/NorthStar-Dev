// src/app/api/messages/[userId]/route.ts
// GET  — fetch conversation between current user and target user (requires accepted connection)
// POST — send a new direct message

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { directMessages, users, circleConnections } from "@/drizzle/schema";
import { and, asc, eq, or } from "drizzle-orm";
import type { NextRequest } from "next/server";

async function isConnected(userA: string, userB: string): Promise<boolean> {
  const [conn] = await db
    .select({ id: circleConnections.id })
    .from(circleConnections)
    .where(
      and(
        eq(circleConnections.status, "accepted"),
        or(
          and(eq(circleConnections.requesterId, userA), eq(circleConnections.receiverId, userB)),
          and(eq(circleConnections.requesterId, userB), eq(circleConnections.receiverId, userA))
        )
      )
    )
    .limit(1);
  return Boolean(conn);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId: otherId } = await params;

  if (!(await isConnected(sessionUserId, otherId))) {
    return NextResponse.json({ error: "Not connected" }, { status: 403 });
  }

  try {
    // Mark incoming messages as read
    await db
      .update(directMessages)
      .set({ isRead: true })
      .where(
        and(
          eq(directMessages.senderId, otherId),
          eq(directMessages.receiverId, sessionUserId),
          eq(directMessages.isRead, false)
        )
      );

    const [messages, otherUserRows] = await Promise.all([
      db
        .select({
          id: directMessages.id,
          senderId: directMessages.senderId,
          text: directMessages.text,
          isRead: directMessages.isRead,
          createdAt: directMessages.createdAt,
        })
        .from(directMessages)
        .where(
          or(
            and(eq(directMessages.senderId, sessionUserId), eq(directMessages.receiverId, otherId)),
            and(eq(directMessages.senderId, otherId), eq(directMessages.receiverId, sessionUserId))
          )
        )
        .orderBy(asc(directMessages.createdAt))
        .limit(100),

      db
        .select({ id: users.id, name: users.name, username: users.username, image: users.image })
        .from(users)
        .where(eq(users.id, otherId))
        .limit(1),
    ]);

    return NextResponse.json({ messages, otherUser: otherUserRows[0] ?? null });
  } catch (err) {
    console.error("[GET /api/messages/[userId]]", err);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId: otherId } = await params;

  if (!(await isConnected(sessionUserId, otherId))) {
    return NextResponse.json({ error: "Not connected" }, { status: 403 });
  }

  try {
    const body: unknown = await req.json();
    const parsed = z.object({ text: z.string().min(1).max(1000).trim() }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid message" }, { status: 422 });
    }

    const [msg] = await db
      .insert(directMessages)
      .values({ senderId: sessionUserId, receiverId: otherId, text: parsed.data.text })
      .returning();

    // Fire-and-forget notification
    void (async () => {
      try {
        const { notificationsService } = await import("@/server/services/notifications.service");
        const [sender] = await db
          .select({ name: users.name, username: users.username })
          .from(users)
          .where(eq(users.id, sessionUserId))
          .limit(1);
        const senderName = sender?.name ?? (sender?.username ? `@${sender.username}` : "Someone");
        await notificationsService.createNotification(
          otherId,
          "group_message",
          "New message",
          `${senderName} sent you a message.`,
          "/circle"
        );
      } catch { /* silent */ }
    })();

    return NextResponse.json({ message: msg }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/messages/[userId]]", err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
