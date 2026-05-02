export const runtime = "edge";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { goalIntentionsService } from "@/server/services/goal-intentions.service";

const patchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  recurrence: z.enum(["none", "daily", "weekly", "monthly", "custom"]).optional(),
  notes: z.string().max(500).optional().nullable(),
});

interface Ctx { params: Promise<{ goalId: string; intentionId: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { intentionId } = await params;
  const body: unknown = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 422 });
  }

  try {
    const intention = await goalIntentionsService.update(intentionId, userId, {
      ...parsed.data,
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
    });
    return NextResponse.json({ intention });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { intentionId } = await params;
  await goalIntentionsService.delete(intentionId, userId);
  return NextResponse.json({ success: true });
}
