// src/app/api/groups/[id]/route.ts
// GET    /api/groups/[id] — public group profile
// PATCH  /api/groups/[id] — update group (owner/admin)
// DELETE /api/groups/[id] — archive group (owner)

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupsService } from "@/server/services/groups.service";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).optional(),
  type: z.enum(["public", "private"]).optional(),
  icon: z.string().max(10).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const group = await groupsService.getGroupPublicProfile(id, userId);
    if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ group });
  } catch (err) {
    console.error("[GET /api/groups/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch group" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body: unknown = await request.json();
    const validated = patchSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 422 }
      );
    }
    await groupsService.updateGroup(id, userId, validated.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/groups/[id]]", err);
    const message = err instanceof Error ? err.message : "Failed to update group";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await groupsService.archiveGroup(id, userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/groups/[id]]", err);
    const message = err instanceof Error ? err.message : "Failed to archive group";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
