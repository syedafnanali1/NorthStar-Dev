// src/app/api/groups/[id]/chat/[postId]/comments/route.ts
// GET  — fetch all comments for a post
// POST — add a comment (member only, 100-word cap)

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupChatService } from "@/server/services/group-chat.service";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ id: string; postId: string }>;
}

const schema = z.object({
  content: z.string().min(1).max(2000),
});

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await params;
  try {
    const comments = await groupChatService.getComments(postId);
    return NextResponse.json({ comments });
  } catch (err) {
    console.error("[GET /api/groups/[id]/chat/[postId]/comments]", err);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

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
      return NextResponse.json({ error: "Validation failed", details: validated.error.flatten() }, { status: 422 });
    }
    const comment = await groupChatService.addComment(postId, userId, validated.data.content);
    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/groups/[id]/chat/[postId]/comments]", err);
    const message = err instanceof Error ? err.message : "Failed to add comment";
    const status = message.includes("100 words") ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
