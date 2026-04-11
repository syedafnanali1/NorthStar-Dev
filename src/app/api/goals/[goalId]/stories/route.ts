import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { storiesService } from "@/server/services/stories.service";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ goalId: string }>;
}

const createSchema = z.object({
  text: z.string().max(400).optional(),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(["image", "video"]).optional(),
});

export async function GET(
  _request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goalId } = await ctx.params;
  const stories = await storiesService.listGoalStories(goalId, userId);
  return NextResponse.json({ stories });
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { goalId } = await ctx.params;
    const body = (await request.json()) as unknown;
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const story = await storiesService.createStory({
      userId,
      goalId,
      text: parsed.data.text,
      mediaUrl: parsed.data.mediaUrl,
      mediaType: parsed.data.mediaType,
    });
    return NextResponse.json({ story }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create story";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

