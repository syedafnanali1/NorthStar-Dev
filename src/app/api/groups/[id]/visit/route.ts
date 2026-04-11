// src/app/api/groups/[id]/visit/route.ts
// POST /api/groups/[id]/visit — record a session visit (deduplicated per day).
// Called client-side when a user opens the community page.

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupEngagementService } from "@/server/services/group-engagement.service";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

  const { id: groupId } = await params;

  // Fire and forget — response is immediate
  void groupEngagementService.recordSessionVisit(userId, groupId);

  return NextResponse.json({ ok: true });
}
