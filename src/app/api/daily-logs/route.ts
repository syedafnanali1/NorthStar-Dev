// src/app/api/daily-logs/route.ts
// GET  /api/daily-logs?date=YYYY-MM-DD — get log for a specific date
// POST /api/daily-logs — create or update a daily log

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { dailyLogs } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { saveDailyLogSchema } from "@/lib/validators/daily-log";
import { achievementService } from "@/server/services/achievements.service";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const month = searchParams.get("month"); // YYYY-MM — fetch all logs for a month

  try {
    if (date) {
      const [log] = await db
        .select()
        .from(dailyLogs)
        .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)))
        .limit(1);
      return NextResponse.json({ log: log ?? null });
    }

    if (month) {
      const logs = await db
        .select()
        .from(dailyLogs)
        .where(eq(dailyLogs.userId, userId));
      // Filter in JS since Drizzle doesn't have a great LIKE helper
      const filtered = logs.filter((l) => l.date.startsWith(month));
      return NextResponse.json({ logs: filtered });
    }

    return NextResponse.json({ error: "date or month parameter required" }, { status: 400 });
  } catch (err) {
    console.error("[GET /api/daily-logs]", err);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    const validated = saveDailyLogSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validated.error.flatten() },
        { status: 422 }
      );
    }

    const { date, mood, sleep, reflection, completedTaskIds } = validated.data;

    // Upsert: update if exists, insert if not
    const [existing] = await db
      .select()
      .from(dailyLogs)
      .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)))
      .limit(1);

    let log;
    if (existing) {
      [log] = await db
        .update(dailyLogs)
        .set({
          mood: mood ?? null,
          sleep: sleep ?? null,
          reflection: reflection ?? null,
          completedTaskIds,
          updatedAt: new Date(),
        })
        .where(eq(dailyLogs.id, existing.id))
        .returning();
    } else {
      [log] = await db
        .insert(dailyLogs)
        .values({
          userId,
          date,
          mood: mood ?? null,
          sleep: sleep ?? null,
          reflection: reflection ?? null,
          completedTaskIds,
        })
        .returning();

      // First log achievement
      await achievementService.award(userId, "ignition");
    }

    return NextResponse.json({ log }, { status: 200 });
  } catch (err) {
    console.error("[POST /api/daily-logs]", err);
    return NextResponse.json({ error: "Failed to save log" }, { status: 500 });
  }
}
