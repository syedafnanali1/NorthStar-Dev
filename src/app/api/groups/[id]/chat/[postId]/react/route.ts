// src/app/api/groups/[id]/chat/[postId]/react/route.ts
// POST /api/groups/[id]/chat/[postId]/react — toggle an emoji reaction

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupChatService } from "@/server/services/group-chat.service";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ id: string; postId: string }>;
}

const schema = z.object({
  emoji: z.string().min(1).max(8),
});

export async function POST(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await params;
  try {
    const body: unknown = await request.json();
    const validated = schema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: "emoji required" }, { status: 422 });
    }
    const result = await groupChatService.toggleReaction(postId, userId, validated.data.emoji);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/groups/[id]/chat/[postId]/react]", err);
    const message = err instanceof Error ? err.message : "Failed to react";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
