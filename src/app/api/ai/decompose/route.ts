// src/app/api/ai/decompose/route.ts
// POST /api/ai/decompose - parse a natural-language goal description into
// a full structured goal object.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import type { NextRequest } from "next/server";
import { aiCoachService } from "@/server/services/ai-coach.service";
import { normalizeDecomposedGoalOutput } from "@/lib/goal-intelligence";

const bodySchema = z.object({
  description: z.string().min(10).max(500),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const rawGoal = await aiCoachService.decomposeNaturalLanguageGoal(
      parsed.data.description
    );
    const goal = normalizeDecomposedGoalOutput(rawGoal, parsed.data.description);
    return NextResponse.json({ goal });
  } catch (err) {
    console.error("[POST /api/ai/decompose]", err);
    const message = err instanceof Error ? err.message : "Decomposition failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
