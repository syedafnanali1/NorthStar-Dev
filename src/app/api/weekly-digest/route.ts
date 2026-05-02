export const runtime = "edge";

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { weeklyDigestService } from "@/server/services/weekly-digest.service";

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await weeklyDigestService.getWeeklyDigestSummary(userId);
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[GET /api/weekly-digest]", err);
    return NextResponse.json({ error: "Failed to load weekly digest" }, { status: 500 });
  }
}

