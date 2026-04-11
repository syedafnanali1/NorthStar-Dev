// src/app/api/goals/[goalId]/route.ts
// GET    /api/goals/:goalId  — get one goal
// PATCH  /api/goals/:goalId  — update goal
// DELETE /api/goals/:goalId  — archive goal

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { goalsService } from "@/server/services/goals.service";
import { updateGoalSchema } from "@/lib/validators/goals";
import { xpService } from "@/server/services/xp.service";
import { integrationsService } from "@/server/services/integrations.service";
import { db } from "@/lib/db";
import { goals } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import type { NextRequest } from "next/server";

interface RouteParams {
  params: Promise<{ goalId: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { goalId } = await params;

  const goal = await goalsService.getById(goalId, userId);
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ goal });
}

export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { goalId } = await params;

  try {
    const body = await request.json() as unknown;

    // Handle milestone completion specially
    const withMilestone = z.object({ completeMilestone: z.string() }).safeParse(body);
    if (withMilestone.success) {
      const goal = await goalsService.completeMilestone(goalId, userId, withMilestone.data.completeMilestone);
      return NextResponse.json({ goal });
    }

    const validated = updateGoalSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: "Validation failed", details: validated.error.flatten() }, { status: 422 });
    }

    const { startDate, endDate, ...rest } = validated.data;
    const updateData: Partial<typeof goals.$inferInsert> = {
      ...rest,
      updatedAt: new Date(),
    };

    if (startDate !== undefined) {
      updateData.startDate = startDate ? new Date(startDate) : null;
    }

    if (endDate !== undefined) {
      updateData.endDate = endDate ? new Date(endDate) : null;
    }

    const [updated] = await db
      .update(goals)
      .set(updateData)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .returning();

    if (updated?.isCompleted === true) {
      void xpService.awardXP(userId, "complete_goal");
      void integrationsService
        .emitEvent({
          userIds: [userId],
          event: "goal.completed",
          payload: {
            goalId: updated.id,
            title: updated.title,
            currentValue: updated.currentValue,
            targetValue: updated.targetValue,
          },
        })
        .catch(() => null);
    }

    return NextResponse.json({ goal: updated });
  } catch (err) {
    console.error("[PATCH /api/goals/:id]", err);
    return NextResponse.json({ error: "Failed to update goal" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { goalId } = await params;

  try {
    await goalsService.archive(goalId, userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/goals/:id]", err);
    return NextResponse.json({ error: "Failed to archive goal" }, { status: 500 });
  }
}
