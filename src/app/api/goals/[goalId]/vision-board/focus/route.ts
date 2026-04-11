import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { visionBoardService } from "@/server/services/vision-board.service";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ goalId: string }>;
}

export async function GET(
  _request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { goalId } = await ctx.params;

  try {
    const payload = await visionBoardService.getFocusPayload(goalId, userId);
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load focus mode payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

