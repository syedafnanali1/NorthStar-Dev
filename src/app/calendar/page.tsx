// src/app/calendar/page.tsx
import type { Metadata } from "next";
import { requireAuthUser } from "@/lib/auth/helpers";
import { AppLayout } from "@/components/layout/app-layout";
import { CalendarView } from "./calendar-view";
import { db } from "@/lib/db";
import { goalTasks, goals, dailyLogs } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

export const metadata: Metadata = { title: "Daily Log" };

export default async function CalendarPage() {
  const user = await requireAuthUser();

  const [tasks, userGoals, monthLogs] = await Promise.all([
    db.select().from(goalTasks).where(eq(goalTasks.userId, user.id)),
    db
      .select({
        id: goals.id,
        title: goals.title,
        color: goals.color,
        emoji: goals.emoji,
        category: goals.category,
        currentValue: goals.currentValue,
        targetValue: goals.targetValue,
        unit: goals.unit,
        startDate: goals.startDate,
        endDate: goals.endDate,
      })
      .from(goals)
      .where(and(eq(goals.userId, user.id), eq(goals.isArchived, false))),
    db.select().from(dailyLogs).where(eq(dailyLogs.userId, user.id)),
  ]);

  const serializedGoals = userGoals.map((g) => ({
    ...g,
    startDate: g.startDate ? g.startDate.toISOString() : null,
    endDate: g.endDate ? g.endDate.toISOString() : null,
  }));

  return (
    <AppLayout rightPanelVariant="calendar">
      {/* ── Page Header ────────────────────────────────────── */}
      <div className="mb-5 lg:mb-6">
        <p className="section-label lg:desktop-kicker">Track Every Day</p>
        <h1 className="mt-2 text-3xl font-serif text-ink sm:text-4xl lg:desktop-page-title">
          Daily Log
        </h1>
        <p className="mt-1.5 font-serif italic text-ink-muted lg:mt-2" style={{ fontSize: "0.9375rem" }}>
          Log intentions, mood, and reflection — one day at a time.
        </p>
      </div>

      <CalendarView tasks={tasks} goals={serializedGoals} allLogs={monthLogs} />
    </AppLayout>
  );
}
