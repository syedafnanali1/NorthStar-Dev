import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { storiesService } from "@/server/services/stories.service";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ storyId: string }>;
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storyId } = await ctx.params;
  await storiesService.archiveStory(storyId, userId);
  return NextResponse.json({ success: true });
}

