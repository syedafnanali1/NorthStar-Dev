export const runtime = "edge";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { visionBoardService } from "@/server/services/vision-board.service";
import type { NextRequest } from "next/server";

const bodySchema = z.object({
  description: z.string().min(5).max(1200),
});

interface RouteContext {
  params: Promise<{ goalId: string }>;
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { goalId } = await ctx.params;

  try {
    const body: unknown = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const result = await visionBoardService.generateFromDescription(
      goalId,
      userId,
      parsed.data.description
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate vision board";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

