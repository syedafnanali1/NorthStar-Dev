export const runtime = "edge";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { goalIntentionsService } from "@/server/services/goal-intentions.service";
import { goalsService } from "@/server/services/goals.service";

const createSchema = z.object({
  title: z.string().min(1).max(120),
  scheduledAt: z.string().datetime().optional().nullable(),
  recurrence: z.enum(["none", "daily", "weekly", "monthly", "custom"]).default("none"),
  notes: z.string().max(500).optional().nullable(),
});

interface Ctx { params: Promise<{ goalId: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goalId } = await params;
  const goal = await goalsService.getById(goalId, userId);
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const intentions = await goalIntentionsService.listForGoal(goalId);
  return NextResponse.json({ intentions });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goalId } = await params;
  const goal = await goalsService.getById(goalId, userId);
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body: unknown = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 422 });
  }

  const intention = await goalIntentionsService.create(goalId, userId, {
    ...parsed.data,
    scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
  });

  return NextResponse.json({ intention }, { status: 201 });
}
