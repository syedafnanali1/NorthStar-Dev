// src/app/calendar/calendar-view.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameDay, isToday, addMonths, subMonths, parseISO,
  startOfWeek, addWeeks, subWeeks, endOfWeek, addDays, subDays, subYears,
} from "date-fns";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import type { GoalTask, DailyLog } from "@/drizzle/schema";
import { useTodayTasks } from "@/lib/contexts/today-tasks-context";

interface GoalMeta {
  id: string;
  title: string;
  color: string;
  emoji: string | null;
  category: string;
  currentValue: number;
  targetValue: number | null;
  unit: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface CalendarViewProps {
  tasks: GoalTask[];
  goals: GoalMeta[];
  allLogs: DailyLog[];
}

interface DailyIntention {
  id: string;
  text: string;
  done: boolean;
}

type DailyLogWithIntentions = DailyLog & {
  dailyIntentions?: DailyIntention[];
};

const MOODS = [
  { value: "energized", label: "Energized", emoji: "🌟" },
  { value: "focused",   label: "Focused",   emoji: "🔥" },
  { value: "good",      label: "Good",      emoji: "😊" },
  { value: "neutral",   label: "Neutral",   emoji: "😐" },
  { value: "tired",     label: "Tired",     emoji: "😓" },
  { value: "anxious",   label: "Anxious",   emoji: "😰" },
  { value: "low",       label: "Low",       emoji: "😔" },
] as const;

const SLEEP = [
  { value: "under_5",    label: "Under 5h", emoji: "😴" },
  { value: "five_to_6",  label: "5–6 hrs",  emoji: "🌙" },
  { value: "six_to_7",   label: "6–7 hrs",  emoji: "✨" },
  { value: "seven_to_8", label: "7–8 hrs",  emoji: "⭐" },
  { value: "over_8",     label: "8+ hrs",   emoji: "🌟" },
] as const;

function getDominantLabel(
  logs: DailyLog[],
  valueSelector: (log: DailyLog) => string | null,
  labelMap: Record<string, string>,
  fallback: string
): string {
  const counts = new Map<string, number>();
  for (const log of logs) {
    const key = valueSelector(log);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let topKey = "";
  let topCount = -1;
  for (const [key, count] of counts.entries()) {
    if (count > topCount) { topKey = key; topCount = count; }
  }
  return topKey ? (labelMap[topKey] ?? topKey) : fallback;
}

function goalActiveOnDay(goal: GoalMeta, year: number, month: number, day: number): boolean {
  const d = new Date(year, month, day);
  if (!goal.startDate && !goal.endDate) return true;
  const start = goal.startDate ? parseISO(goal.startDate) : null;
  const end   = goal.endDate   ? parseISO(goal.endDate)   : null;
  if (start && !end) return d >= start;
  if (!start && end) return d <= end;
  if (start && end)  return d >= start && d <= end;
  return true;
}

function getLogDailyIntentions(log: DailyLog | undefined): DailyIntention[] {
  const withIntentions = log as DailyLogWithIntentions | undefined;
  return Array.isArray(withIntentions?.dailyIntentions)
    ? withIntentions.dailyIntentions
    : [];
}

// ── Mood/Sleep Tracker ───────────────────────────────────────────
type TrackerPeriod = "week" | "month" | "year" | "overall";

function MoodSleepTracker({ allLogs }: { allLogs: DailyLog[] }) {
  const [period, setPeriod] = useState<TrackerPeriod>("month");
  const now = new Date();

  const filteredLogs = allLogs.filter((log) => {
    const d = parseISO(log.date);
    if (period === "week")    return d >= subDays(now, 7);
    if (period === "month")   return d >= subMonths(now, 1);
    if (period === "year")    return d >= subYears(now, 1);
    return true; // overall
  });

  const totalLogged = filteredLogs.length;

  // Mood distribution
  const moodCounts = new Map<string, number>();
  for (const log of filteredLogs) {
    if (!log.mood) continue;
    moodCounts.set(log.mood, (moodCounts.get(log.mood) ?? 0) + 1);
  }

  // Sleep distribution
  const sleepCounts = new Map<string, number>();
  for (const log of filteredLogs) {
    if (!log.sleep) continue;
    sleepCounts.set(log.sleep, (sleepCounts.get(log.sleep) ?? 0) + 1);
  }

  const maxMood  = Math.max(...Array.from(moodCounts.values()), 1);
  const maxSleep = Math.max(...Array.from(sleepCounts.values()), 1);

  const PERIODS: { key: TrackerPeriod; label: string }[] = [
    { key: "week",    label: "Week"    },
    { key: "month",   label: "Month"   },
    { key: "year",    label: "Year"    },
    { key: "overall", label: "All time" },
  ];

  return (
    <div className="panel-shell overflow-hidden">
      {/* Header */}
      <div className="border-b border-cream-dark px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="section-label">Mood & Sleep Patterns</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {totalLogged > 0 ? `${totalLogged} day${totalLogged !== 1 ? "s" : ""} logged` : "No data yet"}
          </p>
        </div>
        {/* Period selector */}
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={cn(
                "h-7 rounded-full border px-3 text-xs font-medium transition-all",
                period === p.key
                  ? "border-ink bg-ink text-cream-paper"
                  : "border-cream-dark text-ink-muted hover:border-ink-muted hover:text-ink"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-0 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-cream-dark">

        {/* ── Mood ─────────────────────────────────────── */}
        <div className="p-5">
          <p className="section-label mb-4">Mood</p>
          {totalLogged === 0 ? (
            <p className="text-sm italic text-ink-muted">Log a few days to see patterns.</p>
          ) : (
            <div className="space-y-2.5">
              {MOODS.map((m) => {
                const count = moodCounts.get(m.value) ?? 0;
                const pct   = Math.round((count / maxMood) * 100);
                return (
                  <div key={m.value} className="flex items-center gap-2.5">
                    <span className="w-5 text-center text-sm leading-none">{m.emoji}</span>
                    <span className="w-[4.5rem] flex-shrink-0 text-xs text-ink-muted truncate">{m.label}</span>
                    <div className="flex-1 h-2 overflow-hidden rounded-full bg-cream-dark">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: count > 0 ? `${pct}%` : "0%",
                          background: count > 0 ? "#C4963A" : "transparent",
                          minWidth: count > 0 ? "6px" : "0px",
                        }}
                      />
                    </div>
                    <span className="w-6 text-right font-mono text-xs text-ink-muted flex-shrink-0">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Sleep ────────────────────────────────────── */}
        <div className="p-5">
          <p className="section-label mb-4">Sleep</p>
          {totalLogged === 0 ? (
            <p className="text-sm italic text-ink-muted">Log a few days to see patterns.</p>
          ) : (
            <div className="space-y-2.5">
              {SLEEP.map((s) => {
                const count = sleepCounts.get(s.value) ?? 0;
                const pct   = Math.round((count / maxSleep) * 100);
                // Color based on quality — more sleep = more green-ish gold, less = muted
                const quality = s.value === "seven_to_8" || s.value === "over_8" ? "#6B8C7A"
                  : s.value === "six_to_7" ? "#C4963A"
                  : s.value === "five_to_6" ? "#B5705B"
                  : "#8C857D";
                return (
                  <div key={s.value} className="flex items-center gap-2.5">
                    <span className="w-5 text-center text-sm leading-none">{s.emoji}</span>
                    <span className="w-[4.5rem] flex-shrink-0 text-xs text-ink-muted truncate">{s.label}</span>
                    <div className="flex-1 h-2 overflow-hidden rounded-full bg-cream-dark">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: count > 0 ? `${pct}%` : "0%",
                          background: count > 0 ? quality : "transparent",
                          minWidth: count > 0 ? "6px" : "0px",
                        }}
                      />
                    </div>
                    <span className="w-6 text-right font-mono text-xs text-ink-muted flex-shrink-0">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────
export function CalendarView({ tasks, goals, allLogs }: CalendarViewProps) {
  const router = useRouter();
  const todayTasksCtx = useTodayTasks();
  const [currentMonth, setCurrentMonth]   = useState(new Date());
  const [selectedDate, setSelectedDate]   = useState<Date>(new Date());
  const [viewMode, setViewMode]           = useState<"week" | "month">("week");
  const [weekStart, setWeekStart]         = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [filterGoalId, setFilterGoalId]   = useState<string | null>(null);

  const [mood, setMood]               = useState<string>("");
  const [sleep, setSleep]             = useState<string>("");
  const [reflection, setReflection]   = useState("");
  const [dailyIntentions, setDailyIntentions] = useState<DailyIntention[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const [saving, setSaving]           = useState(false);

  // Goals collapsed by default — Set stores EXPANDED goal IDs
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());

  const logMap = new Map(allLogs.map((l) => [l.date, l]));

  const goalTaskMap = new Map<string, Set<string>>();
  for (const task of tasks) {
    if (!goalTaskMap.has(task.goalId)) goalTaskMap.set(task.goalId, new Set());
    goalTaskMap.get(task.goalId)!.add(task.id);
  }

  const selectedKey = format(selectedDate, "yyyy-MM-dd");

  const loadDayData = (date: Date) => {
    const key = format(date, "yyyy-MM-dd");
    const log = logMap.get(key);
    const ids = new Set(log?.completedTaskIds ?? []);
    setMood(log?.mood ?? "");
    setSleep(log?.sleep ?? "");
    setReflection(log?.reflection ?? "");
    setDailyIntentions(getLogDailyIntentions(log));
    setCompletedTaskIds(ids);
    setExpandedGoals(new Set()); // collapse all goals when switching days
    if (isToday(date)) todayTasksCtx.setCompletedIds(ids);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isToday(selectedDate)) todayTasksCtx.setCompletedIds(completedTaskIds); }, []);

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    loadDayData(date);
    if (viewMode === "month") {
      setWeekStart(startOfWeek(date, { weekStartsOn: 1 }));
      setViewMode("week");
    }
  };

  const navigateDay = (direction: 1 | -1) => {
    const next = addDays(selectedDate, direction);
    setSelectedDate(next);
    loadDayData(next);
    const newWeekStart = startOfWeek(next, { weekStartsOn: 1 });
    if (!isSameDay(newWeekStart, weekStart)) setWeekStart(newWeekStart);
    setCurrentMonth(next);
  };

  const toggleTask = (taskId: string) => {
    setCompletedTaskIds((prev) => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      if (isToday(selectedDate)) todayTasksCtx.setCompletedIds(next);
      return next;
    });
  };

  const toggleGoal = (goalId: string) => {
    setExpandedGoals((prev) => {
      const next = new Set(prev);
      next.has(goalId) ? next.delete(goalId) : next.add(goalId);
      return next;
    });
  };

  const toggleDailyIntention = (intentionId: string) => {
    setDailyIntentions((prev) =>
      prev.map((item) =>
        item.id === intentionId ? { ...item, done: !item.done } : item
      )
    );
  };

  const addDailyIntention = () => {
    const value = window.prompt("Add an intention for this day");
    if (!value) return;
    const text = value.trim();
    if (!text) return;
    setDailyIntentions((prev) => [
      ...prev,
      { id: `di_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, text: text.slice(0, 160), done: false },
    ]);
  };

  const handleSave = async () => {
    if (!mood)  { toast("Please select your mood for this day", "error"); return; }
    if (!sleep) { toast("Please select hours slept for this day", "error"); return; }
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
          dailyIntentions,
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

  // ── Computed ─────────────────────────────────────────────────
  const monthStart = startOfMonth(currentMonth);
  const monthEnd   = endOfMonth(currentMonth);
  const days       = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad   = getDay(monthStart);
  const selectedLog = logMap.get(selectedKey);
  const doneIntentions  = dailyIntentions.filter((i) => i.done).length;
  const totalIntentions = dailyIntentions.length;

  const monthLogs = allLogs.filter((l) => l.date.startsWith(format(currentMonth, "yyyy-MM")));
  const daysLogged     = monthLogs.length;
  const tasksThisMonth = monthLogs.reduce(
    (sum, log) => sum + getLogDailyIntentions(log).filter((i) => i.done).length, 0
  );
  const bestDayTasks = Math.max(...allLogs.map((log) => getLogDailyIntentions(log).filter((i) => i.done).length), 0);
  const monthProgressPct = days.length > 0 ? Math.round((daysLogged / days.length) * 100) : 0;

  const moodTrend = getDominantLabel(
    monthLogs, (log) => log.mood ?? null,
    Object.fromEntries(MOODS.map((m) => [m.value, `${m.emoji} ${m.label}`])), ""
  );
  const sleepTrend = getDominantLabel(
    monthLogs, (log) => log.sleep ?? null,
    Object.fromEntries(SLEEP.map((s) => [s.value, `${s.emoji} ${s.label}`])), ""
  );

  const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekDays  = viewMode === "week"
    ? eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) })
    : null;
  const gridDays  = weekDays ?? days;
  const padCount  = viewMode === "month" ? startPad : 0;
  const dayLabels = viewMode === "week"
    ? weekDayLabels
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Active goals with tasks for selected day
  const activeGoalTasks = goals
    .filter((g) => goalActiveOnDay(g, selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()))
    .map((g) => ({ ...g, tasks: tasks.filter((t) => t.goalId === g.id) }))
    .filter((g) => g.tasks.length > 0);

  // Total progress across goal tasks + free intentions
  const doneGoalTasks  = activeGoalTasks.reduce((sum, g) => sum + g.tasks.filter((t) => completedTaskIds.has(t.id)).length, 0);
  const totalGoalTasks = activeGoalTasks.reduce((sum, g) => sum + g.tasks.length, 0);
  const doneAll  = doneGoalTasks + doneIntentions;
  const totalAll = totalGoalTasks + totalIntentions;
  const donePct  = totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0;

  const selectedMood  = MOODS.find((m) => m.value === mood);
  const selectedSleep = SLEEP.find((s) => s.value === sleep);

  // Shared pill style
  const pill = (active: boolean) => cn(
    "h-8 rounded-full border px-3 text-xs font-medium transition-all whitespace-nowrap",
    active
      ? "border-ink bg-ink text-cream-paper"
      : "border-cream-dark text-ink-muted hover:border-ink-muted hover:text-ink"
  );

  // ── Day log shared content ───────────────────────────────────
  const dayLogContent = (compact = false) => (
    <div className={cn("space-y-5", compact ? "p-4 sm:p-5" : "px-6 py-5")}>

      {/* Today's Goals — collapsible */}
      {activeGoalTasks.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-3">
            <p className="section-label">Today&apos;s Goals</p>
            <span className="h-px flex-1 bg-cream-dark" />
          </div>
          <div className="space-y-1.5">
            {activeGoalTasks.map((goal) => {
              const isExpanded = expandedGoals.has(goal.id);
              const doneTasks  = goal.tasks.filter((t) => completedTaskIds.has(t.id)).length;
              return (
                <div key={goal.id} className="overflow-hidden rounded-xl border border-cream-dark">
                  {/* Goal header — click to toggle */}
                  <button
                    type="button"
                    onClick={() => toggleGoal(goal.id)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-cream-dark/30"
                    style={{ background: isExpanded ? `${goal.color}08` : undefined }}
                  >
                    {goal.emoji && (
                      <span className="text-sm leading-none flex-shrink-0">{goal.emoji}</span>
                    )}
                    <p className="section-label flex-1 truncate" style={{ color: goal.color }}>
                      {goal.title}
                    </p>
                    <span className="font-mono text-[0.6875rem] text-ink-muted flex-shrink-0">
                      {doneTasks}/{goal.tasks.length}
                    </span>
                    {/* Mini progress bar */}
                    <div className="w-12 h-1 overflow-hidden rounded-full bg-cream-dark flex-shrink-0">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${goal.tasks.length > 0 ? Math.round((doneTasks / goal.tasks.length) * 100) : 0}%`,
                          background: goal.color,
                        }}
                      />
                    </div>
                    {isExpanded
                      ? <ChevronUp className="h-3.5 w-3.5 text-ink-muted flex-shrink-0" />
                      : <ChevronDown className="h-3.5 w-3.5 text-ink-muted flex-shrink-0" />}
                  </button>

                  {/* Tasks — visible when expanded */}
                  {isExpanded && (
                    <div className="divide-y divide-cream-dark/40 border-t border-cream-dark">
                      {goal.tasks.map((task) => {
                        const done = completedTaskIds.has(task.id);
                        return (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => toggleTask(task.id)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-sm transition-all duration-150",
                              done ? "bg-ink/[0.03]" : "hover:bg-cream-dark/25"
                            )}
                          >
                            <span className={cn(
                              "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border text-[10px] font-bold",
                              done ? "border-gold bg-gold text-ink" : "border-ink-muted/50"
                            )}>
                              {done && "✓"}
                            </span>
                            <span className={cn(
                              "flex-1 leading-snug text-ink",
                              done && "line-through text-ink-muted opacity-60"
                            )}>
                              {task.text}
                            </span>
                            {task.isRepeating && (
                              <span className="flex-shrink-0 section-label opacity-40">Daily</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Free Intentions */}
      <div>
        <div className="mb-2.5 flex items-center gap-3">
          <p className="section-label">Intentions</p>
          <span className="h-px flex-1 bg-cream-dark" />
          <button
            type="button"
            onClick={addDailyIntention}
            className="btn-icon h-7 w-7 rounded-full"
            aria-label="Add daily intention"
          >
            +
          </button>
          {totalIntentions > 0 && (
            <span className="font-mono text-xs text-ink-muted">{doneIntentions}/{totalIntentions}</span>
          )}
        </div>
        <div className="space-y-1.5">
          {dailyIntentions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-cream-dark px-3.5 py-3 text-sm italic text-ink-muted">
              Add your own intention for today.
            </p>
          ) : (
            dailyIntentions.map((intention) => {
              const done = intention.done;
              return (
                <button
                  key={intention.id}
                  type="button"
                  onClick={() => toggleDailyIntention(intention.id)}
                  className={cn(
                    "w-full flex min-h-[40px] items-center gap-3 rounded-xl border px-3.5 py-2 text-left text-sm transition-all duration-150",
                    done
                      ? "border-ink bg-ink text-cream-paper"
                      : "border-cream-dark bg-cream-paper text-ink hover:border-ink-muted/70"
                  )}
                >
                  <span className={cn(
                    "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border text-[10px] font-bold",
                    done ? "border-gold bg-gold text-ink" : "border-ink-muted/50"
                  )}>
                    {done && "✓"}
                  </span>
                  <span className={cn("flex-1 leading-snug", done && "line-through opacity-55")}>
                    {intention.text}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Mood */}
      <div>
        <div className="mb-2.5 flex items-center gap-3">
          <p className="section-label">Mood</p>
          <span className="h-px flex-1 bg-cream-dark" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MOODS.map((m) => (
            <button key={m.value} type="button" onClick={() => setMood(m.value)} className={pill(mood === m.value)}>
              {m.emoji} {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sleep */}
      <div>
        <div className="mb-2.5 flex items-center gap-3">
          <p className="section-label">Sleep</p>
          <span className="h-px flex-1 bg-cream-dark" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SLEEP.map((s) => (
            <button key={s.value} type="button" onClick={() => setSleep(s.value)} className={pill(sleep === s.value)}>
              {s.emoji} {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reflection */}
      <div>
        <div className="mb-2.5 flex items-center gap-3">
          <p className="section-label">Reflection</p>
          <span className="text-xs text-ink-muted">optional</span>
          <span className="h-px flex-1 bg-cream-dark" />
        </div>
        <textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="What stood out today? What will you carry forward?"
          className="form-input h-[72px] resize-none font-serif italic"
        />
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary w-full rounded-xl">
        {saving ? "Saving..." : "Save This Day"}
      </button>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-page-in">

      {/* Month Stats Strip */}
      <div className="grid grid-cols-4 divide-x divide-cream-dark overflow-hidden rounded-2xl border border-cream-dark bg-cream-paper">
        {[
          { val: daysLogged,             label: "Days Logged"    },
          { val: tasksThisMonth,         label: "Tasks Done"     },
          { val: bestDayTasks,           label: "Best Day"       },
          { val: `${monthProgressPct}%`, label: "Month Progress" },
        ].map((s) => (
          <div key={s.label} className="px-4 py-3.5 lg:px-5 lg:py-4">
            <div className="text-xl font-serif font-semibold text-ink lg:text-2xl">{s.val}</div>
            <p className="mt-1 section-label">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Trend Chips */}
      {(moodTrend || sleepTrend) && (
        <div className="flex flex-wrap gap-2">
          {moodTrend && (
            <span className="stat-chip">
              <span className="section-label">Mood</span>
              <span className="text-ink-soft">{moodTrend}</span>
            </span>
          )}
          {sleepTrend && (
            <span className="stat-chip">
              <span className="section-label">Sleep</span>
              <span className="text-ink-soft">{sleepTrend}</span>
            </span>
          )}
        </div>
      )}

      {/* Goal Filter Pills (mobile) */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide lg:hidden">
        <button
          type="button"
          onClick={() => setFilterGoalId(null)}
          className={cn(
            "flex-shrink-0 h-8 rounded-full border px-3.5 text-sm font-medium transition-all",
            !filterGoalId ? "border-ink bg-ink text-cream-paper" : "border-cream-dark bg-cream-paper text-ink-muted"
          )}
        >
          All
        </button>
        {goals.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setFilterGoalId(filterGoalId === g.id ? null : g.id)}
            className="flex-shrink-0 flex items-center gap-1.5 h-8 rounded-full border px-3 text-sm font-medium transition-all hover:opacity-80"
            style={{
              borderColor: filterGoalId === g.id ? g.color : undefined,
              color: g.color,
              background: filterGoalId === g.id ? `${g.color}18` : undefined,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: g.color }} />
            {g.emoji} <span className="max-w-[96px] truncate">{g.title}</span>
          </button>
        ))}
      </div>

      {/* Desktop Calendar Header */}
      <div className="hidden space-y-3 lg:block">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => viewMode === "week" ? setWeekStart(subWeeks(weekStart, 1)) : setCurrentMonth(subMonths(currentMonth, 1))}
              className="btn-icon h-8 w-8 rounded-full flex-shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="font-serif text-[1.75rem] font-semibold leading-none text-ink">
              {viewMode === "week"
                ? `${format(weekStart, "MMM d")} – ${format(endOfWeek(weekStart, { weekStartsOn: 1 }), "d, yyyy")}`
                : format(currentMonth, "MMMM yyyy")}
            </h2>
            <button
              onClick={() => viewMode === "week" ? setWeekStart(addWeeks(weekStart, 1)) : setCurrentMonth(addMonths(currentMonth, 1))}
              className="btn-icon h-8 w-8 rounded-full flex-shrink-0"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (viewMode === "week") { setCurrentMonth(weekStart); setViewMode("month"); }
                else { setWeekStart(startOfWeek(selectedDate, { weekStartsOn: 1 })); setViewMode("week"); }
              }}
              className={cn("btn-icon h-8 w-8 rounded-full flex-shrink-0", viewMode === "month" && "border-ink bg-ink text-cream-paper")}
            >
              <CalendarDays className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setFilterGoalId(null)}
              className={cn(
                "h-7 rounded-full border px-3 text-xs font-medium transition-all",
                !filterGoalId ? "border-ink bg-ink text-cream-paper" : "border-cream-dark text-ink-muted hover:border-ink-muted hover:text-ink"
              )}
            >
              All
            </button>
            {goals.slice(0, 6).map((goal) => {
              const isFiltered = filterGoalId === goal.id;
              return (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => setFilterGoalId(isFiltered ? null : goal.id)}
                  className="h-7 flex items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all hover:opacity-80"
                  style={{
                    borderColor: isFiltered ? goal.color : undefined,
                    color: goal.color,
                    background: isFiltered ? `${goal.color}18` : undefined,
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: goal.color }} />
                  {goal.emoji} <span className="max-w-[80px] truncate">{goal.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Calendar Header */}
      <div className="flex items-center justify-between lg:hidden">
        {viewMode === "week" ? (
          <>
            <button onClick={() => setWeekStart(subWeeks(weekStart, 1))} className="btn-icon h-8 w-8 rounded-full">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-xl font-semibold text-ink">
                {format(weekStart, "MMM d")} – {format(endOfWeek(weekStart, { weekStartsOn: 1 }), "d")}
              </h2>
              <button type="button" onClick={() => { setCurrentMonth(weekStart); setViewMode("month"); }} className="btn-icon h-7 w-7 rounded-full">
                <CalendarDays className="h-3.5 w-3.5" />
              </button>
            </div>
            <button onClick={() => setWeekStart(addWeeks(weekStart, 1))} className="btn-icon h-8 w-8 rounded-full">
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="btn-icon h-8 w-8 rounded-full">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="font-serif text-xl font-semibold text-ink">{format(currentMonth, "MMMM yyyy")}</h2>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="btn-icon h-8 w-8 rounded-full">
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 lg:gap-1.5">
        {dayLabels.map((d) => (
          <div key={d} className="py-1 text-center section-label">{d}</div>
        ))}
        {Array.from({ length: padCount }).map((_, i) => <div key={`pad-${i}`} />)}
        {gridDays.map((day) => {
          const key         = format(day, "yyyy-MM-dd");
          const log         = logMap.get(key);
          const isSelected  = isSameDay(day, selectedDate);
          const isTodayDay  = isToday(day);
          const yr = day.getFullYear(); const mo = day.getMonth(); const dy = day.getDate();
          const baseGoals   = filterGoalId ? goals.filter((g) => g.id === filterGoalId) : goals;
          const activeGoalsOnDay = baseGoals.filter((g) => goalActiveOnDay(g, yr, mo, dy));
          const isDimmed    = filterGoalId !== null && activeGoalsOnDay.length === 0;
          const logIntentions  = getLogDailyIntentions(log);
          const donePctDay  = logIntentions.length > 0
            ? Math.round((logIntentions.filter((i) => i.done).length / logIntentions.length) * 100)
            : 0;
          return (
            <button
              key={key}
              onClick={() => handleDayClick(day)}
              className={cn(
                "relative flex min-h-[60px] flex-col items-start rounded-xl p-2 sm:min-h-[68px] lg:min-h-[76px] lg:rounded-[0.875rem]",
                "border transition-all duration-150 text-left",
                isSelected ? "border-ink bg-ink text-cream-paper shadow-card"
                : isTodayDay ? "border-gold/60 bg-gold/6"
                : "border-cream-dark bg-cream-paper hover:border-ink-muted/60",
                isDimmed && "opacity-35"
              )}
            >
              <span className={cn("text-sm font-semibold leading-none", isSelected ? "text-cream-paper" : isTodayDay ? "text-gold" : "text-ink")}>
                {format(day, "d")}
              </span>
              {log?.mood && !isSelected && (
                <span className="absolute top-1.5 right-1.5 text-[10px] leading-none">
                  {MOODS.find((m) => m.value === log.mood)?.emoji}
                </span>
              )}
              {activeGoalsOnDay.length > 0 && (
                <div className="mt-auto flex gap-0.5 flex-wrap">
                  {activeGoalsOnDay.slice(0, 4).map((g) => {
                    const gTasks = goalTaskMap.get(g.id);
                    const filled = gTasks
                      ? [...gTasks].some((tid) => log?.completedTaskIds.includes(tid))
                      : (log?.completedTaskIds.length ?? 0) > 0;
                    return (
                      <div key={g.id} className={cn("w-1.5 h-1.5 rounded-full transition-opacity", filled ? "opacity-85" : "opacity-20")}
                        style={{ background: isSelected ? "white" : g.color }} />
                    );
                  })}
                </div>
              )}
              {donePctDay > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden rounded-b-xl">
                  <div className="h-full" style={{ width: `${donePctDay}%`, background: isSelected ? "rgba(255,255,255,0.5)" : "#C4963A" }} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Day Log Panel (mobile/tablet) ────────────────────── */}
      <div className="panel-shell overflow-hidden lg:hidden">
        {/* Header */}
        <div className="border-b border-cream-dark px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => navigateDay(-1)} className="btn-icon h-7 w-7 rounded-full flex-shrink-0">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <h3 className="font-serif text-lg font-semibold text-ink">
                {format(selectedDate, "EEEE, MMMM d")}
              </h3>
              <button type="button" onClick={() => navigateDay(1)} className="btn-icon h-7 w-7 rounded-full flex-shrink-0">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            {totalAll > 0 && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-mono text-xs text-ink-muted">{doneAll}/{totalAll}</span>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-cream-dark">
                  <div className="h-full bg-gold transition-all" style={{ width: `${donePct}%` }} />
                </div>
              </div>
            )}
          </div>
          {/* Status chips */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <p className="text-xs text-ink-muted flex-shrink-0">
              {selectedLog ? "Log saved" : "Log your progress, check intentions & leave a reflection."}
            </p>
          </div>
          {(selectedMood || selectedSleep || totalAll > 0) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedMood && (
                <span className="stat-chip gap-1">
                  <span>{selectedMood.emoji}</span>
                  <span className="text-ink-soft">{selectedMood.label}</span>
                </span>
              )}
              {selectedSleep && (
                <span className="stat-chip gap-1">
                  <span>{selectedSleep.emoji}</span>
                  <span className="text-ink-soft">{selectedSleep.label}</span>
                </span>
              )}
              {totalAll > 0 && (
                <span className="stat-chip gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold flex-shrink-0" />
                  <span className="text-ink-soft">{doneAll}/{totalAll} completed</span>
                </span>
              )}
            </div>
          )}
        </div>
        {dayLogContent(true)}
      </div>

      {/* ── Day Log Panel (desktop) ───────────────────────────── */}
      <div className="hidden overflow-hidden rounded-2xl border border-cream-dark bg-cream-paper lg:block">
        {/* Header */}
        <div className="border-b border-cream-dark px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => navigateDay(-1)} className="btn-icon h-8 w-8 flex-shrink-0 rounded-full">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div>
                <h3 className="font-serif text-[1.75rem] leading-tight text-ink">
                  {format(selectedDate, "EEEE, MMMM d")}
                </h3>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {selectedLog ? "Log saved for this day" : "Log your progress, check intentions & leave a reflection."}
                </p>
                {/* Status chips */}
                {(selectedMood || selectedSleep || totalAll > 0) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedMood && (
                      <span className="stat-chip gap-1">
                        <span>{selectedMood.emoji}</span>
                        <span className="text-ink-soft">{selectedMood.label}</span>
                      </span>
                    )}
                    {selectedSleep && (
                      <span className="stat-chip gap-1">
                        <span>{selectedSleep.emoji}</span>
                        <span className="text-ink-soft">{selectedSleep.label}</span>
                      </span>
                    )}
                    {totalAll > 0 && (
                      <span className="stat-chip gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-gold flex-shrink-0" />
                        <span className="text-ink-soft">{doneAll}/{totalAll} completed</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => navigateDay(1)} className="btn-icon h-8 w-8 flex-shrink-0 rounded-full">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            {/* Progress bar */}
            {totalAll > 0 && (
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0 pt-1">
                <span className="font-mono text-xs text-ink-muted">{doneAll}/{totalAll} done</span>
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-cream-dark">
                  <div className="h-full bg-gold transition-all duration-500" style={{ width: `${donePct}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
        {dayLogContent(false)}
      </div>

      {/* ── Mood & Sleep Tracker ─────────────────────────────── */}
      <MoodSleepTracker allLogs={allLogs} />

    </div>
  );
}
