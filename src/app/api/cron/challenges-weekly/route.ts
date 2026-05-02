export const runtime = "edge";

import { NextResponse } from "next/server";
import { challengesService } from "@/server/services/challenges.service";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await challengesService.generateWeeklyMicroChallenges(180);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/cron/challenges-weekly]", err);
    return NextResponse.json(
      { error: "Failed to generate weekly micro challenges" },
      { status: 500 }
    );
  }
}

