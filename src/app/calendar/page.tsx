// src/app/calendar/page.tsx
import type { Metadata } from "next";
import { requireAuthUser } from "@/lib/auth/helpers";
import { AppLayout } from "@/components/layout/app-layout";
import { CalendarView } from "./calendar-view";
import { db } from "@/lib/db";
import { goalTasks, goals, dailyLogs } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { format } from "date-fns";

export const metadata: Metadata = { title: "Daily Log" };

export default async function CalendarPage() {
  const user = await requireAuthUser();
  const now = new Date();
  const monthKey = format(now, "yyyy-MM");

  const [tasks, userGoals, monthLogs] = await Promise.all([
    db.select().from(goalTasks).where(eq(goalTasks.userId, user.id)),
    db
      .select({ id: goals.id, title: goals.title, color: goals.color, emoji: goals.emoji, category: goals.category })
      .from(goals)
      .where(and(eq(goals.userId, user.id), eq(goals.isArchived, false))),
    db.select().from(dailyLogs).where(eq(dailyLogs.userId, user.id)),
  ]);

  const logs = monthLogs.filter((l) => l.date.startsWith(monthKey.slice(0, 4)));

  return (
    <AppLayout>
      <div className="mb-8">
        <p className="text-2xs uppercase tracking-widest text-ink-muted mb-1">Track Every Day</p>
        <h1 className="text-3xl font-serif text-ink">Daily Log</h1>
      </div>
      <CalendarView tasks={tasks} goals={userGoals} allLogs={logs} />
    </AppLayout>
  );
}
