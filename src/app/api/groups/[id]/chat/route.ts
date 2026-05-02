export const runtime = "edge";

// src/app/api/groups/[id]/chat/route.ts
// GET  /api/groups/[id]/chat — fetch posts (newest first, limit 30)
// POST /api/groups/[id]/chat — create a new post (member only, 100-word cap)

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupChatService } from "@/server/services/group-chat.service";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const createSchema = z.object({
  content: z.string().min(1).max(2000),
});

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await params;
  try {
    const posts = await groupChatService.getPosts(groupId, userId);
    return NextResponse.json({ posts });
  } catch (err) {
    console.error("[GET /api/groups/[id]/chat]", err);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await params;
  try {
    const body: unknown = await request.json();
    const validated = createSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: "Validation failed", details: validated.error.flatten() }, { status: 422 });
    }
    const post = await groupChatService.createPost(groupId, userId, validated.data.content);
    return NextResponse.json({ post }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/groups/[id]/chat]", err);
    const message = err instanceof Error ? err.message : "Failed to create post";
    const status = message.includes("100 words") ? 422 : message.includes("Only active") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
