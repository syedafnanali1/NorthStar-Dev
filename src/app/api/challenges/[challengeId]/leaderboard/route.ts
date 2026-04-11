import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { challengesService } from "@/server/services/challenges.service";
import type { NextRequest } from "next/server";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

interface RouteContext {
  params: Promise<{ challengeId: string }>;
}

export async function GET(
  request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { challengeId } = await ctx.params;
  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  try {
    const leaderboard = await challengesService.getLeaderboard(
      challengeId,
      parsed.data.limit
    );
    return NextResponse.json({ leaderboard });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load leaderboard";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

