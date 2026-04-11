// src/app/api/groups/[id]/goals/[goalId]/track/route.ts
// POST /api/groups/[id]/goals/[goalId]/track — toggle "Add to My Calendar"

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupGoalItemsService } from "@/server/services/group-goal-items.service";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ id: string; goalId: string }>;
}

export async function POST(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goalId } = await params;
  try {
    const tracker = await groupGoalItemsService.toggleCalendarTracker(goalId, userId);
    return NextResponse.json({ tracker, added: tracker !== null });
  } catch (err) {
    console.error("[POST /api/groups/[id]/goals/[goalId]/track]", err);
    const message = err instanceof Error ? err.message : "Failed to update calendar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
