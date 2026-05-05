export const runtime = "edge";

// POST /api/groups/[id]/leave — member leaves a group
// Owner cannot leave (must archive or transfer first)

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { groupMembers, groups } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await ctx.params;

  // Find the member row
  const [membership] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);

  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 404 });
  if (membership.role === "owner") {
    return NextResponse.json({ error: "Group owners cannot leave. Archive the group or transfer ownership first." }, { status: 403 });
  }

  // Remove membership and decrement memberCount
  await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));

  await db
    .update(groups)
    .set({ memberCount: db.$count(groupMembers, and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, "active"))) as unknown as number })
    .where(eq(groups.id, groupId))
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
