export const runtime = "edge";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { analyticsEvents } from "@/drizzle/schema";

const eventSchema = z.object({
  eventType: z.string().min(1).max(64),
  entityType: z.string().max(32).optional().nullable(),
  entityId: z.string().max(64).optional().nullable(),
  metadata: z.record(z.unknown()).optional().default({}),
  occurredAt: z.string().datetime().optional(),
});

const batchSchema = z.object({
  events: z.array(eventSchema).min(1).max(50),
});

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: unknown = await req.json();
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 422 });
  }

  const rows = parsed.data.events.map((e) => ({
    id: `aev_${nanoid(12)}`,
    userId,
    eventType: e.eventType,
    entityType: e.entityType ?? null,
    entityId: e.entityId ?? null,
    metadata: e.metadata ?? {},
    occurredAt: e.occurredAt ? new Date(e.occurredAt) : new Date(),
  }));

  await db.insert(analyticsEvents).values(rows);
  return NextResponse.json({ ok: true, count: rows.length });
}
