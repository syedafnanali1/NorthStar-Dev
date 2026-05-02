export const runtime = "edge";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { friendActivityService } from "@/server/services/friend-activity.service";
import type { NextRequest } from "next/server";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  try {
    const feed = await friendActivityService.getFeedForUser(userId, parsed.data.limit);
    return NextResponse.json({ feed });
  } catch (err) {
    console.error("[GET /api/friends/feed]", err);
    return NextResponse.json({ error: "Failed to fetch feed" }, { status: 500 });
  }
}

