import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { coachService } from "@/server/services/coach.service";

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const dashboard = await coachService.getDashboard(userId);
    return NextResponse.json({ dashboard });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch coach dashboard";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

