// src/app/api/circle/connect/route.ts
// POST — send a circle connection request
// PATCH — accept or decline an incoming request

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupChatService } from "@/server/services/group-chat.service";
import { db } from "@/lib/db";
import { circleConnections } from "@/drizzle/schema";
import { and, eq, or, sql } from "drizzle-orm";
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
    await groupChatService.sendCircleRequest(userId, validated.data.receiverId);
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
      .select({ id: circleConnections.id, receiverId: circleConnections.receiverId, status: circleConnections.status })
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
    } else {
      await db.delete(circleConnections).where(eq(circleConnections.id, connectionId));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/circle/connect]", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
