export const runtime = "edge";

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { challengesService } from "@/server/services/challenges.service";

interface RouteContext {
  params: Promise<{ challengeId: string }>;
}

export async function POST(
  _request: Request,
  ctx: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { challengeId } = await ctx.params;
  try {
    const result = await challengesService.joinChallenge(challengeId, userId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to join challenge";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

