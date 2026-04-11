// src/app/api/groups/route.ts
// POST /api/groups — create a new community group
// GET  /api/groups — list groups the current user belongs to

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupsService } from "@/server/services/groups.service";
import type { NextRequest } from "next/server";

const createGroupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80),
  description: z.string().max(500).optional(),
  type: z.enum(["public", "private"]),
  inviteUserIds: z.array(z.string()).max(99).optional().default([]),
  inviteEmails: z.array(z.string().email()).max(99).optional().default([]),
});

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const myGroups = await groupsService.getGroupsForUser(userId);
    return NextResponse.json({ groups: myGroups });
  } catch (err) {
    console.error("[GET /api/groups]", err);
    return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body: unknown = await request.json();
    const validated = createGroupSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 422 }
      );
    }

    const group = await groupsService.createGroup(userId, validated.data);
    return NextResponse.json({ group }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/groups]", err);
    const message = err instanceof Error ? err.message : "Failed to create group";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
