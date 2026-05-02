export const runtime = "edge";

// src/app/api/groups/[id]/goals/suggest/route.ts
// POST /api/groups/[id]/goals/suggest — AI-generated goal suggestion

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupGoalItemsService } from "@/server/services/group-goal-items.service";
import type { NextRequest } from "next/server";

const bodySchema = z.object({
  description: z.string().min(10).max(500),
});

export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body: unknown = await request.json();
    const validated = bodySchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Please describe what your group wants to achieve (10–500 characters)." },
        { status: 422 }
      );
    }
    const suggestion = await groupGoalItemsService.suggestGroupGoal(
      validated.data.description
    );
    return NextResponse.json({ suggestion });
  } catch (err) {
    console.error("[POST /api/groups/[id]/goals/suggest]", err);
    return NextResponse.json({ error: "Failed to generate suggestion" }, { status: 500 });
  }
}
