export const runtime = "edge";

// src/app/api/goals/[goalId]/progress/route.ts
// POST /api/goals/:goalId/progress — log progress for a goal

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { goalsService } from "@/server/services/goals.service";
import { logProgressSchema } from "@/lib/validators/goals";
import { xpService } from "@/server/services/xp.service";
import type { NextRequest } from "next/server";

interface RouteParams {
  params: Promise<{ goalId: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { goalId } = await params;

  try {
    const body: unknown = await request.json();
    const validated = logProgressSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 422 }
      );
    }

    const result = await goalsService.logProgress(goalId, userId, validated.data);
    void xpService.awardXP(userId, "log_progress");
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Goal not found") {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }
    console.error("[POST /api/goals/:id/progress]", err);
    return NextResponse.json({ error: "Failed to log progress" }, { status: 500 });
  }
}
