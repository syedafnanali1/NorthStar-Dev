import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { timelineService } from "@/server/services/timeline.service";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "120", 10);
  const daysBackRaw = Number.parseInt(searchParams.get("daysBack") ?? "3650", 10);
  const includeFriendFeed = searchParams.get("includeFriendFeed") !== "false";

  const [events, onThisDay] = await Promise.all([
    timelineService.getTimeline(userId, {
      limit: Number.isFinite(limitRaw) ? limitRaw : 120,
      daysBack: Number.isFinite(daysBackRaw) ? daysBackRaw : 3650,
      includeFriendFeed,
    }),
    timelineService.getOnThisDay(userId),
  ]);

  return NextResponse.json({ events, onThisDay });
}

