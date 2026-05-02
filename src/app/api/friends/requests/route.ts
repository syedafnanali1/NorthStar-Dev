export const runtime = "edge";

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { friendsService } from "@/server/services/friends.service";

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const requests = await friendsService.getPendingRequests(userId);
    return NextResponse.json({ requests });
  } catch (err) {
    console.error("[GET /api/friends/requests]", err);
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
  }
}

