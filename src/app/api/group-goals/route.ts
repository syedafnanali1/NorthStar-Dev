export const runtime = "edge";

// src/app/api/group-goals/route.ts
// GET  /api/group-goals — list groups the user belongs to
// POST /api/group-goals — create a new group goal

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupGoalsService } from "@/server/services/group-goals.service";
import type { NextRequest } from "next/server";

const createGroupGoalSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(500).optional(),
  category: z.enum(["health", "finance", "writing", "body", "mindset", "custom"]),
  targetValue: z.coerce.number().positive().optional(),
  unit: z.string().max(20).optional(),
  emoji: z.string().max(4).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isPublic: z.boolean().optional().default(false),
  memberLimit: z.coerce.number().int().min(2).max(100).optional().default(20),
  inviteUserIds: z.array(z.string()).max(99).optional().default([]),
});

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const groups = await groupGoalsService.getAllForUser(userId);
    return NextResponse.json({ groups });
  } catch (err) {
    console.error("[GET /api/group-goals]", err);
    return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body: unknown = await request.json();
    const validated = createGroupGoalSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 422 }
      );
    }
    const group = await groupGoalsService.createGroupGoal(userId, validated.data);
    return NextResponse.json({ group }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/group-goals]", err);
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }
}
