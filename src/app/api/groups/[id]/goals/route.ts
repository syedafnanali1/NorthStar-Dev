// src/app/api/groups/[id]/goals/route.ts
// GET  /api/groups/[id]/goals — list active group goals with member stats
// POST /api/groups/[id]/goals — create a group goal (owner/admin)

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupGoalItemsService } from "@/server/services/group-goal-items.service";
import type { NextRequest } from "next/server";

const archiveSchema = z.object({
  goalId: z.string().min(1),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

const createSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(400).optional(),
  category: z.enum(["health", "finance", "writing", "body", "mindset", "custom"]),
  trackingFrequency: z.enum(["daily", "weekly", "monthly", "yearly", "custom"]),
  customFrequencyLabel: z.string().max(40).optional(),
  milestones: z.array(z.string().min(1).max(120)).max(8).optional().default([]),
  targetValue: z.number().positive().optional(),
  unit: z.string().max(20).optional(),
  emoji: z.string().max(4).optional(),
  createdVia: z.enum(["manual", "ai"]).default("manual"),
});

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await params;
  try {
    const goals = await groupGoalItemsService.getGroupGoals(groupId, userId);
    return NextResponse.json({ goals });
  } catch (err) {
    console.error("[GET /api/groups/[id]/goals]", err);
    return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await params;
  try {
    const body: unknown = await request.json();
    const validated = archiveSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json({ error: "goalId required" }, { status: 422 });
    }
    await groupGoalItemsService.archiveGroupGoal(validated.data.goalId, groupId, userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/groups/[id]/goals]", err);
    const message = err instanceof Error ? err.message : "Failed to archive goal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await params;
  try {
    const body: unknown = await request.json();
    const validated = createSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 422 }
      );
    }
    const goal = await groupGoalItemsService.createGroupGoal(
      groupId,
      userId,
      validated.data
    );
    return NextResponse.json({ goal }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/groups/[id]/goals]", err);
    const message = err instanceof Error ? err.message : "Failed to create goal";
    const status = message.includes("Only group owners") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
