export const runtime = "edge";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { aiCoachService } from "@/server/services/ai-coach.service";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [nudges, predictions] = await Promise.all([
      aiCoachService.runNudgeEngineBatch(250),
      aiCoachService.runPredictiveAlertsBatch(250),
    ]);

    return NextResponse.json({
      processedUsers: Math.max(nudges.processed, predictions.processed),
      nudgesCreated: nudges.created,
      predictionAlertsCreated: predictions.created,
      failed: nudges.failed + predictions.failed,
    });
  } catch (err) {
    console.error("[GET /api/cron/ai-goal-coach]", err);
    return NextResponse.json(
      { error: "Failed to run AI goal coach batch" },
      { status: 500 }
    );
  }
}
