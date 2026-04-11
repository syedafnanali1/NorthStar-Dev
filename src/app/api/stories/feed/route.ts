import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { storiesService } from "@/server/services/stories.service";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "60", 10);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 60;

  const stories = await storiesService.listStoryFeed(userId, limit);
  return NextResponse.json({ stories });
}

