export const runtime = "edge";

// PATCH  /api/goals/:goalId/tasks/:taskId — edit an intention
// DELETE /api/goals/:goalId/tasks/:taskId — remove an intention

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { goals, goalTasks } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

interface RouteParams {
  params: Promise<{ goalId: string; taskId: string }>;
}

const updateTaskSchema = z.object({
  text: z.string().min(1).max(200).optional(),
  isRepeating: z.boolean().optional(),
  incrementValue: z.coerce.number().positive().max(1_000_000).nullable().optional(),
});

async function verifyOwnership(goalId: string, taskId: string, userId: string) {
  // Check goal belongs to user
  const [goal] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .limit(1);
  if (!goal) return null;

  // Check task belongs to goal
  const [task] = await db
    .select()
    .from(goalTasks)
    .where(and(eq(goalTasks.id, taskId), eq(goalTasks.goalId, goalId)))
    .limit(1);

  return task ?? null;
}

export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goalId, taskId } = await params;

  const task = await verifyOwnership(goalId, taskId, userId);
  if (!task) return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 });

  const body = await req.json() as unknown;
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }

  const updateData: Partial<typeof goalTasks.$inferInsert> = {};
  if (parsed.data.text !== undefined) updateData.text = parsed.data.text;
  if (parsed.data.isRepeating !== undefined) updateData.isRepeating = parsed.data.isRepeating;
  if (parsed.data.incrementValue !== undefined) updateData.incrementValue = parsed.data.incrementValue;

  const [updated] = await db
    .update(goalTasks)
    .set(updateData)
    .where(eq(goalTasks.id, taskId))
    .returning();

  return NextResponse.json({ task: updated });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goalId, taskId } = await params;

  const task = await verifyOwnership(goalId, taskId, userId);
  if (!task) return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 });

  await db
    .delete(goalTasks)
    .where(eq(goalTasks.id, taskId));

  return NextResponse.json({ success: true });
}
