export const runtime = "edge";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { goalIntentionsService } from "@/server/services/goal-intentions.service";

const schema = z.object({ status: z.enum(["attending", "not_attending"]) });

interface Ctx { params: Promise<{ goalId: string; intentionId: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { intentionId } = await params;
  const body: unknown = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 422 });
  }

  await goalIntentionsService.upsertRsvp(intentionId, userId, parsed.data.status);
  return NextResponse.json({ success: true });
}
