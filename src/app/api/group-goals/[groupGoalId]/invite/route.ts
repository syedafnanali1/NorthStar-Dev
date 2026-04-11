// src/app/api/group-goals/[groupGoalId]/invite/route.ts
// POST /api/group-goals/:id/invite — owner invites users by account or email

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupGoalsService } from "@/server/services/group-goals.service";
import type { NextRequest } from "next/server";

const bodySchema = z.object({
  userIds: z.array(z.string()).max(100).optional().default([]),
  emails: z.array(z.string().email()).max(20).optional().default([]),
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
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const result = await groupGoalsService.inviteMembers(groupGoalId, userId, parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to send invites";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

