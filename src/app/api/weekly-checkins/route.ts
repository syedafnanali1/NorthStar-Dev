export const runtime = "edge";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { weeklyCheckinsService } from "@/server/services/weekly-checkins.service";
import type { NextRequest } from "next/server";

const submitSchema = z.object({
  answers: z.array(z.string().min(2).max(500)).length(5),
  shareToCircle: z.boolean().optional().default(false),
});

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [currentWeek, latest] = await Promise.all([
    weeklyCheckinsService.getForCurrentWeek(userId),
    weeklyCheckinsService.getLatest(userId),
  ]);

  return NextResponse.json({
    weekStartDate: weeklyCheckinsService.getWeekStartKey(),
    currentWeek,
    latest,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as unknown;
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const checkin = await weeklyCheckinsService.submitCheckin({
      userId,
      answers: parsed.data.answers,
      shareToCircle: parsed.data.shareToCircle,
    });
    return NextResponse.json({ checkin }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to submit weekly check-in";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

