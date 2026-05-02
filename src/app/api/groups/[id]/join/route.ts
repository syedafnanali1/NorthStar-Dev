export const runtime = "edge";

// src/app/api/groups/[id]/join/route.ts
// POST /api/groups/[id]/join — submit a join request for a public group

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupsService } from "@/server/services/groups.service";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  note: z.string().max(300).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body: unknown = await request.json().catch(() => ({}));
    const { note } = bodySchema.parse(body);
    await groupsService.requestToJoin(id, userId, note);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/groups/[id]/join]", err);
    const message = err instanceof Error ? err.message : "Failed to submit request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
