export const runtime = "edge";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { friendsService } from "@/server/services/friends.service";
import { db } from "@/lib/db";
import { circleConnections } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

const bodySchema = z.object({
  action: z.enum(["accept", "decline"]),
});

interface RouteContext {
  params: Promise<{ connectionId: string }>;
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { connectionId } = await ctx.params;
  try {
    const body: unknown = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    await friendsService.respondToRequest(userId, connectionId, parsed.data.action);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// DELETE — requester cancels their own outgoing invite
export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { connectionId } = await ctx.params;
  await db
    .delete(circleConnections)
    .where(
      and(eq(circleConnections.id, connectionId), eq(circleConnections.requesterId, userId))
    );

  return NextResponse.json({ ok: true });
}

