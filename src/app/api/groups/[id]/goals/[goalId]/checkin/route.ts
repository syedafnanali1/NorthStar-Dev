export const runtime = "edge";

// src/app/api/groups/[id]/goals/[goalId]/checkin/route.ts
// POST /api/groups/[id]/goals/[goalId]/checkin — log a check-in
// GET  /api/groups/[id]/goals/[goalId]/checkin — get recent check-ins (my own)

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupGoalItemsService } from "@/server/services/group-goal-items.service";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ id: string; goalId: string }>;
}

const checkInSchema = z.object({
  value: z.number().positive().optional().default(1),
  note: z.string().max(300).optional(),
  markCompleted: z.boolean().optional().default(false),
});

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goalId } = await params;
  try {
    const checkIns = await groupGoalItemsService.getMyCheckIns(goalId, userId);
    return NextResponse.json({ checkIns });
  } catch (err) {
    console.error("[GET /api/groups/[id]/goals/[goalId]/checkin]", err);
    return NextResponse.json({ error: "Failed to fetch check-ins" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goalId } = await params;
  try {
    const body: unknown = await request.json().catch(() => ({}));
    const validated = checkInSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 422 });
    }

    const { value, note, markCompleted } = validated.data;
    await groupGoalItemsService.logCheckIn(goalId, userId, value, note);

    if (markCompleted) {
      await groupGoalItemsService.markCompleted(goalId, userId);
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/groups/[id]/goals/[goalId]/checkin]", err);
    const message = err instanceof Error ? err.message : "Failed to log check-in";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
