// src/app/api/goals/[goalId]/moments/route.ts
// GET  /api/goals/:goalId/moments — list moments for a goal
// POST /api/goals/:goalId/moments — add a moment to a goal

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { goalsService } from "@/server/services/goals.service";
import { createMomentSchema } from "@/lib/validators/goals";
import { db } from "@/lib/db";
import { moments, users } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import type { NextRequest } from "next/server";

interface RouteParams {
  params: Promise<{ goalId: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { goalId } = await params;

  try {
    const goalMoments = await db
      .select({
        id: moments.id,
        text: moments.text,
        visibility: moments.visibility,
        createdAt: moments.createdAt,
        author: {
          id: users.id,
          name: users.name,
          image: users.image,
        },
      })
      .from(moments)
      .leftJoin(users, eq(moments.userId, users.id))
      .where(eq(moments.goalId, goalId))
      .orderBy(desc(moments.createdAt))
      .limit(20);

    return NextResponse.json({ moments: goalMoments });
  } catch (err) {
    console.error("[GET /api/goals/:id/moments]", err);
    return NextResponse.json({ error: "Failed to fetch moments" }, { status: 500 });
  }
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
    const validated = createMomentSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 422 }
      );
    }

    const moment = await goalsService.addMoment(goalId, userId, validated.data);
    return NextResponse.json({ moment }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Goal not found") {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }
    console.error("[POST /api/goals/:id/moments]", err);
    return NextResponse.json({ error: "Failed to save moment" }, { status: 500 });
  }
}
