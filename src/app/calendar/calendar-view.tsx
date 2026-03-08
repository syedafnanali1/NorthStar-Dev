// src/app/calendar/calendar-view.tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameDay, isToday, addMonths, subMonths, parseISO,
} from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import type { GoalTask, DailyLog } from "@/drizzle/schema";

interface GoalMeta {
  id: string;
  title: string;
  color: string;
  emoji: string | null;
  category: string;
}

interface CalendarViewProps {
  tasks: GoalTask[];
  goals: GoalMeta[];
  allLogs: DailyLog[];
}

const MOODS = [
  { value: "energized", label: "Energized", emoji: "🌟" },
  { value: "good", label: "Good", emoji: "😊" },
  { value: "neutral", label: "Neutral", emoji: "😐" },
  { value: "tired", label: "Tired", emoji: "😓" },
  { value: "low", label: "Low", emoji: "😔" },
  { value: "focused", label: "Focused", emoji: "🔥" },
  { value: "anxious", label: "Anxious", emoji: "😰" },
] as const;

const SLEEP = [
  { value: "under_5", label: "Under 5 hrs", emoji: "😴" },
  { value: "five_to_6", label: "5–6 hrs", emoji: "🌙" },
  { value: "six_to_7", label: "6–7 hrs", emoji: "✨" },
  { value: "seven_to_8", label: "7–8 hrs", emoji: "⭐" },
  { value: "over_8", label: "8+ hrs", emoji: "🌟" },
] as const;

export function CalendarView({ tasks, goals, allLogs }: CalendarViewProps) {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Log form state
  const [mood, setMood] = useState<string>("");
  const [sleep, setSleep] = useState<string>("");
  const [reflection, setReflection] = useState("");
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const logMap = new Map(allLogs.map((l) => [l.date, l]));

  const loadDayData = useCallback((date: Date) => {
    const key = format(date, "yyyy-MM-dd");
    const log = logMap.get(key);
    setMood(log?.mood ?? "");
    setSleep(log?.sleep ?? "");
    setReflection(log?.reflection ?? "");
    setCompletedTaskIds(new Set(log?.completedTaskIds ?? []));
  }, [logMap]);

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    loadDayData(date);
  };

  const toggleTask = (taskId: string) => {
    setCompletedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/daily-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: format(selectedDate, "yyyy-MM-dd"),
          mood: mood || null,
          sleep: sleep || null,
          reflection: reflection || null,
          completedTaskIds: Array.from(completedTaskIds),
        }),
      });
      if (!res.ok) throw new Error();
      toast("Day logged ✓");
      router.refresh();
    } catch {
      toast("Failed to save log", "error");
    } finally {
      setSaving(false);
    }
  };

  // Build calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);
  const selectedKey = format(selectedDate, "yyyy-MM-dd");
  const selectedLog = logMap.get(selectedKey);
  const donePct = tasks.length > 0 ? Math.round((completedTaskIds.size / tasks.length) * 100) : 0;

  // Month stats
  const monthLogs = allLogs.filter((l) => l.date.startsWith(format(currentMonth, "yyyy-MM")));
  const daysLogged = monthLogs.length;
  const tasksThisMonth = monthLogs.reduce((a, l) => a + l.completedTaskIds.length, 0);

  return (
    <div className="space-y-6">
      {/* Month stats strip */}
      <div className="grid grid-cols-4 divide-x divide-cream-dark card overflow-hidden">
        {[
          { val: daysLogged, label: "Days Logged" },
          { val: tasksThisMonth, label: "Tasks Done" },
          { val: `${Math.max(...allLogs.map((l) => l.completedTaskIds.length), 0)} 🔥`, label: "Best Day" },
          { val: `${Math.round((daysLogged / days.length) * 100)}%`, label: "Month Progress" },
        ].map((s) => (
          <div key={s.label} className="p-4">
            <div className="text-2xl font-serif font-semibold text-ink">{s.val}</div>
            <div className="text-2xs uppercase tracking-wide text-ink-muted mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Calendar header */}
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="btn-icon">‹</button>
        <h2 className="text-2xl font-serif font-semibold text-ink">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="btn-icon">›</button>
      </div>

      {/* Goal color strip */}
      <div className="flex flex-wrap gap-2">
        {goals.map((g) => (
          <div
            key={g.id}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-[1.5px] text-xs font-medium"
            style={{ borderColor: g.color, color: g.color }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: g.color }} />
            {g.emoji} {g.title}
          </div>
        ))}
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1.5">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center text-2xs uppercase tracking-wide text-ink-muted py-1">
            {d}
          </div>
        ))}
        {/* Empty pads */}
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {/* Days */}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const log = logMap.get(key);
          const isSelected = isSameDay(day, selectedDate);
          const isTodayDay = isToday(day);
          const donePctDay = tasks.length > 0 && log
            ? Math.round((log.completedTaskIds.length / tasks.length) * 100)
            : 0;

          return (
            <button
              key={key}
              onClick={() => handleDayClick(day)}
              className={cn(
                "relative flex flex-col items-start rounded-2xl p-2.5 min-h-[72px]",
                "border-[1.5px] transition-all text-left",
                isSelected
                  ? "border-ink bg-ink text-cream-paper shadow-card-hover"
                  : isTodayDay
                  ? "border-gold bg-gold/5"
                  : "border-cream-dark bg-cream-paper hover:border-ink-muted hover:-translate-y-0.5"
              )}
            >
              <span className={cn(
                "text-sm font-semibold leading-none mb-1.5",
                isSelected ? "text-cream-paper/90" : isTodayDay ? "text-gold" : "text-ink"
              )}>
                {format(day, "d")}
              </span>

              {/* Goal dots */}
              {goals.length > 0 && (
                <div className="flex gap-0.5 flex-wrap mb-auto">
                  {goals.slice(0, 4).map((g) => (
                    <div
                      key={g.id}
                      className="w-1.5 h-1.5 rounded-full opacity-70"
                      style={{ background: g.color }}
                    />
                  ))}
                </div>
              )}

              {/* Bottom progress bar */}
              <div className={cn(
                "absolute bottom-0 left-0 right-0 h-[3px] rounded-b-2xl overflow-hidden",
                isSelected ? "bg-white/10" : "bg-cream-dark"
              )}>
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${donePctDay}%`,
                    background: isSelected ? "rgba(255,255,255,0.5)" : "#C4963A",
                  }}
                />
              </div>

              {/* Mood emoji */}
              {log?.mood && (
                <span className="absolute top-2 right-2 text-[11px]">
                  {MOODS.find((m) => m.value === log.mood)?.emoji}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Day Log Panel */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-cream-dark flex items-center justify-between">
          <div>
            <h3 className="font-serif font-semibold text-ink text-lg">
              {format(selectedDate, "EEEE, MMMM d")}
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              {donePct}% done today
            </p>
          </div>
          <div className="h-1.5 rounded-full bg-cream-dark overflow-hidden w-24">
            <div className="h-full bg-gold transition-all" style={{ width: `${donePct}%` }} />
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Mood + Sleep */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Mood</label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                className="form-input"
              >
                <option value="">— Choose mood —</option>
                {MOODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.emoji} {m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Sleep</label>
              <select
                value={sleep}
                onChange={(e) => setSleep(e.target.value)}
                className="form-input"
              >
                <option value="">— Hours slept —</option>
                {SLEEP.map((s) => (
                  <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tasks checklist */}
          {tasks.length > 0 && (
            <div>
              <label className="form-label">Today&apos;s Intentions</label>
              <div className="space-y-2">
                {tasks.map((task) => {
                  const done = completedTaskIds.has(task.id);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => toggleTask(task.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-[1.5px]",
                        "text-left text-sm transition-all",
                        done
                          ? "bg-ink border-ink text-cream-paper"
                          : "bg-cream border-cream-dark text-ink hover:border-ink-muted"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border text-xs",
                        done ? "bg-gold border-gold text-ink" : "bg-cream-paper border-ink-muted"
                      )}>
                        {done && "✓"}
                      </div>
                      <span className={done ? "line-through opacity-50" : ""}>{task.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reflection */}
          <div>
            <label className="form-label">Reflection (optional)</label>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="How was this day?"
              className="form-input resize-none h-24 font-serif italic"
            />
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
            {saving ? "Saving..." : "Save This Day's Log →"}
          </button>
        </div>
      </div>
    </div>
  );
}
