export const runtime = "edge";

// src/app/api/circle/connect/route.ts
// POST — send a circle connection request (fires notification to receiver)
// PATCH — accept or decline an incoming request (fires notification to requester on accept)

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupChatService } from "@/server/services/group-chat.service";
import { notificationsService } from "@/server/services/notifications.service";
import { db } from "@/lib/db";
import { circleConnections, users } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

const sendSchema = z.object({
  receiverId: z.string().min(1),
});

const respondSchema = z.object({
  connectionId: z.string().min(1),
  action: z.enum(["accept", "decline"]),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body: unknown = await request.json();
    const validated = sendSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: "receiverId required" }, { status: 422 });
    }

    const { receiverId } = validated.data;

    // Send the connection request
    const connectionId = await groupChatService.sendCircleRequest(userId, receiverId);

    // Fetch requester's profile for the notification bio card
    const [requester] = await db
      .select({
        name: users.name,
        username: users.username,
        image: users.image,
        bio: users.bio,
        location: users.location,
        jobTitle: users.jobTitle,
        currentStreak: users.currentStreak,
        totalGoalsCompleted: users.totalGoalsCompleted,
        momentumScore: users.momentumScore,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Fire in-app notification to the receiver
    if (requester) {
      const displayName = requester.name ?? requester.username ?? "Someone";
      await notificationsService.createNotification(
        receiverId,
        "friend_activity",
        `${displayName} wants to join your Circle`,
        requester.bio
          ? `"${requester.bio.slice(0, 80)}${requester.bio.length > 80 ? "…" : ""}"`
          : `${displayName} sent you a circle request.`,
        `/circle`,
        {
          metadata: {
            subtype: "circle_request",
            connectionId: connectionId ?? "",
            requesterId: userId,
            requesterName: requester.name,
            requesterUsername: requester.username,
            requesterImage: requester.image,
            requesterBio: requester.bio,
            requesterLocation: requester.location,
            requesterJobTitle: requester.jobTitle,
            requesterStreak: requester.currentStreak,
            requesterGoals: requester.totalGoalsCompleted,
            requesterMomentum: requester.momentumScore,
          },
        }
      );
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/circle/connect]", err);
    const message = err instanceof Error ? err.message : "Failed to send request";
    const status =
      message.includes("Already connected") || message.includes("already pending") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body: unknown = await request.json();
    const validated = respondSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 422 });
    }

    const { connectionId, action } = validated.data;

    // Only the receiver can accept/decline
    const [conn] = await db
      .select({
        id: circleConnections.id,
        requesterId: circleConnections.requesterId,
        receiverId: circleConnections.receiverId,
        status: circleConnections.status,
      })
      .from(circleConnections)
      .where(eq(circleConnections.id, connectionId))
      .limit(1);

    if (!conn) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (conn.receiverId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (conn.status !== "pending") {
      return NextResponse.json({ error: "Request is no longer pending" }, { status: 409 });
    }

    if (action === "accept") {
      await db
        .update(circleConnections)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(circleConnections.id, connectionId));

      // Notify the original requester that they were accepted
      const [accepter] = await db
        .select({ name: users.name, username: users.username, image: users.image })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (accepter) {
        const displayName = accepter.name ?? accepter.username ?? "Someone";
        await notificationsService.createNotification(
          conn.requesterId,
          "friend_activity",
          `${displayName} accepted your Circle request`,
          `You and ${displayName} are now in each other's Circle. Say hello!`,
          `/circle`,
          {
            metadata: {
              subtype: "circle_accepted",
              accepterId: userId,
              accepterName: accepter.name,
              accepterUsername: accepter.username,
              accepterImage: accepter.image,
            },
          }
        );
      }
    } else {
      await db.delete(circleConnections).where(eq(circleConnections.id, connectionId));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/circle/connect]", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
