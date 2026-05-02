export const runtime = "edge";

// src/app/api/group-goals/[groupGoalId]/progress/route.ts
// POST /api/group-goals/:id/progress — log a member contribution

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupGoalsService } from "@/server/services/group-goals.service";
import type { NextRequest } from "next/server";

const bodySchema = z.object({
  value: z.coerce.number().positive().max(1_000_000),
  note: z.string().max(500).optional(),
});

interface RouteContext {
  params: Promise<{ groupGoalId: string }>;
}

export async function POST(request: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupGoalId } = await ctx.params;
  try {
    const body: unknown = await request.json();
    const validated = bodySchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 422 }
      );
    }
    const result = await groupGoalsService.logGroupContribution(
      groupGoalId,
      userId,
      validated.data.value
    );
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to log contribution";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
