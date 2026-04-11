// src/app/api/group-goals/[groupGoalId]/route.ts
// GET    /api/group-goals/:id — full detail
// PATCH  /api/group-goals/:id — update (creator only)
// DELETE /api/group-goals/:id — archive (creator only)

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupGoalsService } from "@/server/services/group-goals.service";
import type { NextRequest } from "next/server";

const updateSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  description: z.string().max(500).optional().transform((v) => v ?? undefined),
  isPublic: z.boolean().optional(),
  memberLimit: z.coerce.number().int().min(2).max(100).optional(),
});

interface RouteContext {
  params: Promise<{ groupGoalId: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupGoalId } = await ctx.params;
  try {
    const group = await groupGoalsService.getGroupDetail(groupGoalId, userId);
    if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ group });
  } catch (err) {
    console.error("[GET /api/group-goals/:id]", err);
    return NextResponse.json({ error: "Failed to fetch group" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupGoalId } = await ctx.params;
  try {
    const body: unknown = await request.json();
    const validated = updateSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 422 }
      );
    }
    const group = await groupGoalsService.updateGroup(groupGoalId, userId, validated.data);
    return NextResponse.json({ group });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update group";
    return NextResponse.json({ error: msg }, { status: 403 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupGoalId } = await ctx.params;
  try {
    await groupGoalsService.archiveGroup(groupGoalId, userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to archive group";
    return NextResponse.json({ error: msg }, { status: 403 });
  }
}
