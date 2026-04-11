import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupGoalsService } from "@/server/services/group-goals.service";
import type { NextRequest } from "next/server";

const createTaskSchema = z.object({
  text: z.string().min(2).max(220),
});

interface RouteContext {
  params: Promise<{ groupGoalId: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupGoalId } = await ctx.params;
  try {
    const tasks = await groupGoalsService.getTasks(groupGoalId, userId);
    return NextResponse.json({ tasks });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch tasks";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function POST(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupGoalId } = await ctx.params;
  try {
    const body: unknown = await req.json();
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const tasks = await groupGoalsService.addTask(groupGoalId, userId, parsed.data.text);
    return NextResponse.json({ tasks }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to add task";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

