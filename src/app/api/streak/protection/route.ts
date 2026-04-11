import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { streakProtectionService } from "@/server/services/streak-protection.service";
import type { NextRequest } from "next/server";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("earn_freeze") }),
  z.object({
    action: z.literal("use_freeze"),
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().max(240).optional(),
  }),
  z.object({
    action: z.literal("ally_vouch"),
    allyUsername: z.string().min(2).max(32),
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().max(240).optional(),
  }),
  z.object({
    action: z.literal("recover"),
    missedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().min(4).max(240),
  }),
]);

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = await streakProtectionService.getStatus(userId);
  return NextResponse.json({ status });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as unknown;
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    if (parsed.data.action === "earn_freeze") {
      const result = await streakProtectionService.awardWeeklyFreeze(userId);
      const status = await streakProtectionService.getStatus(userId);
      return NextResponse.json({ result, status });
    }

    if (parsed.data.action === "use_freeze") {
      const status = await streakProtectionService.useFreeze(
        userId,
        parsed.data.targetDate,
        parsed.data.note
      );
      return NextResponse.json({ status });
    }

    if (parsed.data.action === "ally_vouch") {
      const status = await streakProtectionService.useAllyVouch({
        userId,
        allyUsername: parsed.data.allyUsername,
        targetDate: parsed.data.targetDate,
        note: parsed.data.note,
      });
      return NextResponse.json({ status });
    }

    const status = await streakProtectionService.useRecoveryWindow({
      userId,
      missedDate: parsed.data.missedDate,
      note: parsed.data.note,
    });
    return NextResponse.json({ status });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to process streak action";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

