export const runtime = "edge";

// POST /api/goals/:goalId/tasks — add a new intention/task to a goal
// GET  /api/goals/:goalId/tasks — list all tasks for a goal

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { goals, goalTasks } from "@/drizzle/schema";
import { and, eq, count } from "drizzle-orm";
import type { NextRequest } from "next/server";

interface RouteParams {
  params: Promise<{ goalId: string }>;
}

const createTaskSchema = z.object({
  text: z.string().min(1, "Intention text is required").max(200, "Too long"),
  isRepeating: z.boolean().default(true),
  incrementValue: z.coerce
    .number()
    .positive()
    .max(1_000_000)
    .optional(),
});

export async function GET(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goalId } = await params;

  // Verify ownership
  const [goal] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .limit(1);

  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tasks = await db
    .select()
    .from(goalTasks)
    .where(eq(goalTasks.goalId, goalId))
    .orderBy(goalTasks.order);

  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goalId } = await params;

  // Verify ownership (only goal owner can add tasks)
  const [goal] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .limit(1);

  if (!goal) return NextResponse.json({ error: "Not found or not authorized" }, { status: 404 });

  // Enforce max 10 tasks per goal
  const countRows = await db
    .select({ taskCount: count() })
    .from(goalTasks)
    .where(eq(goalTasks.goalId, goalId));
  const taskCount = countRows[0]?.taskCount ?? 0;

  if (taskCount >= 10) {
    return NextResponse.json({ error: "Maximum 10 intentions per goal" }, { status: 422 });
  }

  const body = await req.json() as unknown;
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }

  const [task] = await db
    .insert(goalTasks)
    .values({
      goalId,
      userId,
      text: parsed.data.text,
      isRepeating: parsed.data.isRepeating,
      incrementValue: parsed.data.incrementValue ?? null,
      order: taskCount,
    })
    .returning();

  return NextResponse.json({ task }, { status: 201 });
}
