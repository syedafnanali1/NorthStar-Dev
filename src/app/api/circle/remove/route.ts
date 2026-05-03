export const runtime = "edge";

// POST /api/circle/remove — remove an accepted circle connection
// body: { memberId: string }

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { circleConnections } from "@/drizzle/schema";
import { and, eq, or } from "drizzle-orm";
import type { NextRequest } from "next/server";

const schema = z.object({ memberId: z.string().min(1) });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: unknown = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "memberId required" }, { status: 422 });

  const { memberId } = parsed.data;
  if (memberId === userId) return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });

  await db
    .delete(circleConnections)
    .where(
      and(
        or(
          and(eq(circleConnections.requesterId, userId), eq(circleConnections.receiverId, memberId)),
          and(eq(circleConnections.requesterId, memberId), eq(circleConnections.receiverId, userId))
        )
      )
    );

  return NextResponse.json({ ok: true });
}
