export const runtime = "edge";

// src/app/api/group-goals/[groupGoalId]/intentions/route.ts
// GET list intentions, POST create intention or comment or idea submission

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { groupGoalMembers, groupGoalMessages } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";

const INTENTION_PREFIX = "__intention__:";
const INTENTION_COMMENT_PREFIX = "__intention_comment__:";
const INTENTION_IDEA_PREFIX = "__intention_idea__:";

interface RouteParams {
  params: Promise<{ groupGoalId: string }>;
}

export async function POST(req: Request, { params }: RouteParams) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groupGoalId } = await params;

  const [membership] = await db
    .select({ role: groupGoalMembers.role })
    .from(groupGoalMembers)
    .where(
      and(eq(groupGoalMembers.groupGoalId, groupGoalId), eq(groupGoalMembers.userId, userId))
    )
    .limit(1);

  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const body = (await req.json()) as {
    type: "intention" | "comment" | "idea";
    title?: string;
    description?: string;
    frequency?: "daily" | "weekly" | "monthly" | "yearly" | "custom";
    targetDate?: string;
    intentionId?: string;
    text?: string;
  };

  if (body.type === "intention") {
    if (membership.role !== "creator") {
      return NextResponse.json({ error: "Only the creator can add intentions" }, { status: 403 });
    }
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    const payload = {
      title: body.title.trim(),
      description: body.description?.trim() || undefined,
      frequency: body.frequency ?? "custom",
      targetDate: body.targetDate || undefined,
    };
    const [msg] = await db
      .insert(groupGoalMessages)
      .values({ groupGoalId, userId, text: `${INTENTION_PREFIX}${JSON.stringify(payload)}` })
      .returning();
    return NextResponse.json({ message: msg });
  }

  if (body.type === "comment") {
    if (!body.intentionId || !body.text?.trim()) {
      return NextResponse.json({ error: "intentionId and text are required" }, { status: 400 });
    }
    const payload = { intentionId: body.intentionId, text: body.text.trim() };
    const [msg] = await db
      .insert(groupGoalMessages)
      .values({ groupGoalId, userId, text: `${INTENTION_COMMENT_PREFIX}${JSON.stringify(payload)}` })
      .returning();
    return NextResponse.json({ message: msg });
  }

  if (body.type === "idea") {
    if (!body.text?.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    const payload = { text: body.text.trim() };
    const [msg] = await db
      .insert(groupGoalMessages)
      .values({ groupGoalId, userId, text: `${INTENTION_IDEA_PREFIX}${JSON.stringify(payload)}` })
      .returning();
    return NextResponse.json({ message: msg });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
