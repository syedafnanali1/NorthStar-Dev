import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { coachService } from "@/server/services/coach.service";
import type { NextRequest } from "next/server";

const assignSchema = z.object({
  clientUserId: z.string(),
  title: z.string().min(2).max(120),
  category: z.enum(["health", "finance", "writing", "body", "mindset", "custom"]),
  unit: z.string().min(1).max(32),
  targetValue: z.number().positive().optional(),
  why: z.string().max(500).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const coachUserId = await getSessionUserId();
  if (!coachUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as unknown;
    const parsed = assignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const goal = await coachService.assignGoal({
      coachUserId,
      clientUserId: parsed.data.clientUserId,
      title: parsed.data.title,
      category: parsed.data.category,
      unit: parsed.data.unit,
      targetValue: parsed.data.targetValue,
      why: parsed.data.why,
    });
    return NextResponse.json({ goal }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to assign goal";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

