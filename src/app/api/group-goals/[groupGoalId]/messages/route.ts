// src/app/api/group-goals/[groupGoalId]/messages/route.ts
// GET  /api/group-goals/:id/messages — last 20 messages
// POST /api/group-goals/:id/messages — send a message

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupGoalsService } from "@/server/services/group-goals.service";
import type { NextRequest } from "next/server";

const sendSchema = z.object({
  text: z.string().min(1).max(1000),
});

interface RouteContext {
  params: Promise<{ groupGoalId: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupGoalId } = await ctx.params;
  try {
    const messages = await groupGoalsService.getMessages(groupGoalId, userId);
    return NextResponse.json({ messages });
  } catch (err) {
    console.error("[GET /api/group-goals/:id/messages]", err);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupGoalId } = await ctx.params;
  try {
    const body: unknown = await request.json();
    const validated = sendSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 422 }
      );
    }
    const message = await groupGoalsService.sendMessage(
      groupGoalId,
      userId,
      validated.data.text
    );
    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to send message";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
