// src/app/api/goals/route.ts
// GET  /api/goals — list all goals for the authenticated user
// POST /api/goals — create a new goal

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { goalsService } from "@/server/services/goals.service";
import { createGoalSchema } from "@/lib/validators/goals";
import type { NextRequest } from "next/server";

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const goals = await goalsService.getAllForUser(userId);
    return NextResponse.json({ goals });
  } catch (err) {
    console.error("[GET /api/goals]", err);
    return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    const validated = createGoalSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 422 }
      );
    }

    const goal = await goalsService.create(userId, validated.data);
    return NextResponse.json({ goal }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/goals]", err);
    const message = err instanceof Error ? err.message : "Failed to create goal";
    const status = /free plan supports up to/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
