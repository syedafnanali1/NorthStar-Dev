// src/app/api/groups/[id]/requests/route.ts
// GET   /api/groups/[id]/requests — list pending join requests (owner/admin)
// PATCH /api/groups/[id]/requests — approve or reject a request (owner/admin)

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupsService } from "@/server/services/groups.service";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const reviewSchema = z.object({
  requestId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
});

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const requests = await groupsService.getPendingJoinRequests(id, userId);
    return NextResponse.json({ requests });
  } catch (err) {
    console.error("[GET /api/groups/[id]/requests]", err);
    const message = err instanceof Error ? err.message : "Failed to fetch requests";
    const status = message === "Not authorized." ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: _groupId } = await params;
  try {
    const body: unknown = await request.json();
    const validated = reviewSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 422 }
      );
    }

    const { requestId, action } = validated.data;
    if (action === "approve") {
      await groupsService.approveJoinRequest(requestId, userId);
    } else {
      await groupsService.rejectJoinRequest(requestId, userId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/groups/[id]/requests]", err);
    const message = err instanceof Error ? err.message : "Failed to review request";
    const status = message === "Not authorized." ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
