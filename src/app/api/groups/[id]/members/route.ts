export const runtime = "edge";

// src/app/api/groups/[id]/members/route.ts
// GET /api/groups/[id]/members — list active members with connection status

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupChatService } from "@/server/services/group-chat.service";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await params;
  try {
    const members = await groupChatService.getMembers(groupId, userId);
    return NextResponse.json({ members });
  } catch (err) {
    console.error("[GET /api/groups/[id]/members]", err);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}
