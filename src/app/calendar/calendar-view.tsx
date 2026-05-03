"use client";

// src/app/calendar/calendar-view.tsx
// Unified calendar view matching spec §10:
//   - Horizontal month strip (week scroll)
//   - Event list: Today / This week / Upcoming
//   - Event cards with colored left accent bars + Log / RSVP buttons
//   - Check-in sheet (dark overlay) with feel picker, note, streak, photo

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  format, startOfWeek, endOfWeek, addWeeks, subWeeks,
  addDays, subDays, isToday, isSameDay, parseISO,
  eachDayOfInterval, subMonths, subYears,
} from "date-fns";
import {
  ChevronLeft, ChevronRight, X, Camera, Flame, Check, Plus,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import type { GoalTask, DailyLog } from "@/drizzle/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface CheckinGoal extends GoalMeta {
  goalTasks: GoalTask[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FEELS = [
  { value: "tough",   label: "Tough",   emoji: "😤" },
  { value: "okay",    label: "Okay",    emoji: "😊" },
  { value: "great",   label: "Great",   emoji: "😄" },
  { value: "on_fire", label: "On fire", emoji: "🔥" },
] as const;

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcGoalStreak(taskIds: string[], allLogs: DailyLog[]): number {
  if (taskIds.length === 0) return 0;
  const logMap = new Map(allLogs.map((l) => [l.date, l]));
  let date = new Date();
  // If today not yet logged for this goal, start from yesterday
  const todayKey = format(date, "yyyy-MM-dd");
  const todayLog = logMap.get(todayKey);
  if (!todayLog || !taskIds.some((tid) => todayLog.completedTaskIds.includes(tid))) {
    date = subDays(date, 1);
  }
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const key = format(date, "yyyy-MM-dd");
    const log = logMap.get(key);
    if (!log) break;
    const hasTask = taskIds.some((tid) => log.completedTaskIds.includes(tid));
    if (!hasTask) break;
    streak++;
    date = subDays(date, 1);
  }
  return streak;
}

function goalActiveOnDay(goal: GoalMeta, d: Date): boolean {
  if (!goal.startDate && !goal.endDate) return true;
  const start = goal.startDate ? parseISO(goal.startDate) : null;
  const end   = goal.endDate   ? parseISO(goal.endDate)   : null;
  if (start && d < start) return false;
  if (end   && d > end)   return false;
  return true;
}

function getWeekNum(goal: GoalMeta): number {
  if (!goal.startDate) return 1;
  const diffMs = Date.now() - parseISO(goal.startDate).getTime();
  return Math.max(1, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1);
}

// ─── CheckinSheet ─────────────────────────────────────────────────────────────

function CheckinSheet({
  goal,
  selectedDate,
  allLogs,
  existingCompletedIds,
  onClose,
  onSaved,
}: {
  goal: CheckinGoal;
  selectedDate: Date;
  allLogs: DailyLog[];
  existingCompletedIds: string[];
  onClose: () => void;
  onSaved: (newIds: string[]) => void;
}) {
  const [feel, setFeel] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dateKey = format(selectedDate, "yyyy-MM-dd");

  const streak = calcGoalStreak(goal.goalTasks.map((t) => t.id), allLogs);
  const weekNum = getWeekNum(goal);
  const alreadyLogged =
    goal.goalTasks.length > 0 &&
    goal.goalTasks.every((t) => existingCompletedIds.includes(t.id));

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX = 900;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      canvas.width  = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const compressed = canvas.toDataURL("image/jpeg", 0.78);
      setPhoto(compressed);
      try { localStorage.setItem(`ci_photo_${goal.id}_${dateKey}`, compressed); } catch {}
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleSave = async () => {
    setSaving(true);
    const newIds = [...existingCompletedIds];
    for (const task of goal.goalTasks) {
      if (!newIds.includes(task.id)) newIds.push(task.id);
    }
    try {
      const body: Record<string, unknown> = {
        date: dateKey,
        completedTaskIds: newIds,
        dailyIntentions: [
          { id: `ci_${goal.id}`, text: `${goal.title} check-in`, done: true },
        ],
      };
      if (note) body.reflection = note;
      const res = await fetch("/api/daily-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast(`${goal.emoji ?? "⭐"} Check-in logged!`);
      onSaved(newIds);
      onClose();
    } catch {
      toast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] bg-[#13110F] text-white shadow-2xl overflow-hidden"
        style={{ maxHeight: "92dvh" }}
      >
        <div className="overflow-y-auto" style={{ maxHeight: "92dvh" }}>

          {/* Drag handle (mobile) */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="h-1 w-10 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3.5 border-b border-white/[0.07]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/35">Log check-in</p>
              <p className="mt-0.5 text-sm font-medium text-white/55">
                {goal.title} · Week {weekNum}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 hover:bg-white/15 transition-colors"
            >
              <X className="h-4 w-4 text-white/60" />
            </button>
          </div>

          {/* Goal card */}
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-3xl"
                style={{ background: `${goal.color}25` }}
              >
                {goal.emoji ?? "⭐"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-white">{goal.title}</p>
                {streak > 0 && (
                  <div className="mt-0.5 flex items-center gap-1">
                    <Flame className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                    <span className="text-sm font-semibold text-orange-400">
                      {streak}-day streak!
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* How did it feel? */}
          <div className="px-5 pb-5">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">
              How did it feel?
            </p>
            <div className="grid grid-cols-4 gap-2">
              {FEELS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFeel(f.value === feel ? "" : f.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl py-3.5 border transition-all",
                    feel === f.value
                      ? "border-[#C4963A]/60 bg-[#C4963A]/12"
                      : "border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08]"
                  )}
                >
                  <span className="text-2xl leading-none">{f.emoji}</span>
                  <span
                    className={cn(
                      "text-[11px] font-semibold",
                      feel === f.value ? "text-[#C4963A]" : "text-white/40"
                    )}
                  >
                    {f.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="px-5 pb-4">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional)"
              rows={3}
              className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#C4963A]/30 resize-none"
            />
          </div>

          {/* Photo upload */}
          <div className="px-5 pb-5">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhoto}
            />
            {photo ? (
              <div className="relative overflow-hidden rounded-2xl">
                <img src={photo} alt="Check-in" className="w-full max-h-48 object-cover" />
                <button
                  onClick={() => {
                    setPhoto(null);
                    try { localStorage.removeItem(`ci_photo_${goal.id}_${dateKey}`); } catch {}
                  }}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 hover:bg-black/80 transition-colors"
                >
                  <X className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-3 text-sm text-white/35 hover:border-white/30 hover:text-white/55 transition-all"
              >
                <Camera className="h-4 w-4" />
                Add a photo
              </button>
            )}
          </div>

          {/* Streak banner */}
          {streak > 0 && (
            <div className="mx-5 mb-4 flex items-center justify-center gap-2 rounded-2xl border border-orange-500/20 bg-orange-500/8 py-3">
              <Flame className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-semibold text-orange-400">
                {streak}-day streak! Keep it going 🔥
              </span>
            </div>
          )}

          {/* CTA */}
          <div className="px-5 pb-8 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || alreadyLogged}
              className={cn(
                "w-full rounded-2xl py-4 text-sm font-bold transition-all",
                alreadyLogged
                  ? "cursor-default bg-emerald-500/18 text-emerald-400"
                  : "bg-[#C4963A] text-[#13110F] hover:opacity-90 disabled:opacity-60"
              )}
            >
              {saving
                ? "Logging..."
                : alreadyLogged
                ? "✓ Already logged today"
                : "Log check-in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MonthStrip ───────────────────────────────────────────────────────────────

function MonthStrip({
  selectedDate,
  onSelect,
  weekStart,
  onPrevWeek,
  onNextWeek,
  allLogs,
}: {
  selectedDate: Date;
  onSelect: (d: Date) => void;
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  allLogs: DailyLog[];
}) {
  const weekEnd  = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const logMap   = new Map(allLogs.map((l) => [l.date, l]));

  return (
    <div className="panel-shell overflow-hidden">
      {/* Month nav */}
      <div className="flex items-center justify-between border-b border-cream-dark px-4 py-3">
        <button onClick={onPrevWeek} className="btn-icon h-8 w-8 flex-shrink-0 rounded-full">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="font-serif text-base font-semibold text-ink">
            {format(weekStart, "MMMM yyyy")}
          </p>
          <p className="text-[11px] text-ink-muted">
            {format(weekStart, "MMM d")} – {format(weekEnd, "d")}
          </p>
        </div>
        <button onClick={onNextWeek} className="btn-icon h-8 w-8 flex-shrink-0 rounded-full">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day cells */}
      <div className="px-3 pb-3 pt-2">
        <div className="grid grid-cols-7 gap-1">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div
              key={i}
              className="py-1 text-center text-[10px] font-bold uppercase tracking-wider text-ink-muted"
            >
              {d}
            </div>
          ))}
          {weekDays.map((day) => {
            const key        = format(day, "yyyy-MM-dd");
            const log        = logMap.get(key);
            const isSelected = isSameDay(day, selectedDate);
            const isTodayDay = isToday(day);
            const hasLog     = !!log && (log.completedTaskIds.length > 0 || !!log.mood);

            return (
              <button
                key={key}
                onClick={() => onSelect(day)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl py-2.5 transition-all",
                  isSelected
                    ? "bg-ink"
                    : isTodayDay
                    ? "bg-gold/10"
                    : "hover:bg-cream-dark/40"
                )}
              >
                <span
                  className={cn(
                    "text-sm font-semibold leading-none",
                    isSelected ? "text-cream-paper" : isTodayDay ? "text-gold" : "text-ink"
                  )}
                >
                  {format(day, "d")}
                </span>
                <div
                  className={cn(
                    "h-1 w-1 rounded-full transition-all",
                    hasLog
                      ? isSelected ? "bg-gold" : "bg-gold"
                      : "bg-transparent"
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── EventCard ────────────────────────────────────────────────────────────────

function EventCard({
  goal,
  isLogged,
  dateLabel,
  onLog,
}: {
  goal: GoalMeta;
  isLogged: boolean;
  dateLabel?: string;
  onLog: () => void;
}) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-cream-dark bg-cream-paper transition-all hover:shadow-sm">
      {/* Left accent bar */}
      <div className="w-[3.5px] flex-shrink-0" style={{ background: goal.color }} />

      {/* Content */}
      <div className="flex flex-1 items-center gap-3 px-3.5 py-3">
        <span className="flex-shrink-0 text-xl leading-none">{goal.emoji ?? "⭐"}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{goal.title}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {dateLabel ? `${dateLabel} · ` : ""}Personal
          </p>
        </div>
        {isLogged ? (
          <span className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/12 px-3 py-1.5 text-xs font-semibold text-emerald-600">
            <Check className="h-3 w-3" />
            Logged
          </span>
        ) : (
          <button
            type="button"
            onClick={onLog}
            className="flex-shrink-0 rounded-full bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-600"
          >
            Log
          </button>
        )}
      </div>
    </div>
  );
}

// ─── DayMoodPanel ─────────────────────────────────────────────────────────────
// Compact mood+sleep logger shown when a day is selected

function DayMoodPanel({
  date,
  existingLog,
  onSaved,
}: {
  date: Date;
  existingLog: DailyLog | undefined;
  onSaved: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [mood, setMood]   = useState(existingLog?.mood ?? "");
  const [sleep, setSleep] = useState(existingLog?.sleep ?? "");
  const [saving, setSaving] = useState(false);

  const pill = (active: boolean) =>
    cn(
      "h-8 rounded-full border px-3 text-xs font-medium transition-all whitespace-nowrap",
      active
        ? "border-ink bg-ink text-cream-paper"
        : "border-cream-dark text-ink-muted hover:border-ink-muted hover:text-ink"
    );

  const handleSave = async () => {
    if (!mood || !sleep) return;
    setSaving(true);
    try {
      const existing = existingLog;
      await fetch("/api/daily-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: format(date, "yyyy-MM-dd"),
          mood,
          sleep,
          completedTaskIds: existing?.completedTaskIds ?? [],
        }),
      });
      toast("Day logged ✓");
      setExpanded(false);
      onSaved();
    } catch {
      toast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const currentMood  = MOODS.find((m) => m.value === mood);
  const currentSleep = SLEEP.find((s) => s.value === sleep);

  return (
    <div className="panel-shell overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5"
      >
        <div className="flex items-center gap-2.5">
          <div>
            <p className="text-left text-sm font-semibold text-ink">
              {format(date, "EEEE, MMMM d")}
            </p>
            <div className="mt-0.5 flex items-center gap-2">
              {currentMood  && <span className="text-xs text-ink-muted">{currentMood.emoji} {currentMood.label}</span>}
              {currentMood && currentSleep && <span className="text-ink-muted">·</span>}
              {currentSleep && <span className="text-xs text-ink-muted">{currentSleep.emoji} {currentSleep.label}</span>}
              {!currentMood && !currentSleep && (
                <span className="text-xs text-ink-muted italic">Log mood & sleep for today</span>
              )}
            </div>
          </div>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 flex-shrink-0 text-ink-muted" />
          : <ChevronDown className="h-4 w-4 flex-shrink-0 text-ink-muted" />}
      </button>

      {expanded && (
        <div className="border-t border-cream-dark px-4 pb-4 pt-4 space-y-4">
          <div>
            <p className="section-label mb-2.5">Mood</p>
            <div className="flex flex-wrap gap-1.5">
              {MOODS.map((m) => (
                <button key={m.value} type="button" onClick={() => setMood(m.value)} className={pill(mood === m.value)}>
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="section-label mb-2.5">Sleep</p>
            <div className="flex flex-wrap gap-1.5">
              {SLEEP.map((s) => (
                <button key={s.value} type="button" onClick={() => setSleep(s.value)} className={pill(sleep === s.value)}>
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !mood || !sleep}
            className="btn-primary w-full rounded-xl disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save day log"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── CalendarView ─────────────────────────────────────────────────────────────

export function CalendarView({ tasks, goals, allLogs }: CalendarViewProps) {
  const router = useRouter();

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [checkinGoal, setCheckinGoal]   = useState<CheckinGoal | null>(null);

  // Live-updated completed IDs per date (so cards update after check-in without refresh)
  const [overrides, setOverrides] = useState<Map<string, string[]>>(() => new Map());

  // ── Computed ──
  const logMap = new Map(allLogs.map((l) => [l.date, l]));

  const tasksByGoal = new Map<string, GoalTask[]>();
  for (const task of tasks) {
    const arr = tasksByGoal.get(task.goalId) ?? [];
    arr.push(task);
    tasksByGoal.set(task.goalId, arr);
  }

  function getCompletedIds(date: Date): string[] {
    const key = format(date, "yyyy-MM-dd");
    return overrides.get(key) ?? logMap.get(key)?.completedTaskIds ?? [];
  }

  function isGoalLogged(goal: GoalMeta, date: Date): boolean {
    const ids       = getCompletedIds(date);
    const goalTasks = tasksByGoal.get(goal.id) ?? [];
    return goalTasks.length > 0 && goalTasks.some((t) => ids.includes(t.id));
  }

  function getActiveGoals(date: Date): GoalMeta[] {
    return goals.filter(
      (g) => goalActiveOnDay(g, date) && (tasksByGoal.get(g.id)?.length ?? 0) > 0
    );
  }

  const today = new Date();
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  // Today's events
  const todayGoals = getActiveGoals(today);

  // This week (remaining days, not today)
  const weekSections: { date: Date; dayGoals: GoalMeta[] }[] = [];
  for (let i = 1; i <= 6; i++) {
    const d = addDays(today, i);
    if (d > weekEnd) break;
    const dayGoals = getActiveGoals(d);
    if (dayGoals.length > 0) weekSections.push({ date: d, dayGoals });
  }

  // Upcoming (next 2 weeks after this week) — deduplicated per goal (show once per goal)
  const upcomingGoalIds = new Set<string>();
  const upcomingGoals: GoalMeta[] = [];
  const upcomingStart = addDays(weekEnd, 1);
  for (let i = 0; i < 14; i++) {
    const d = addDays(upcomingStart, i);
    for (const g of getActiveGoals(d)) {
      if (!upcomingGoalIds.has(g.id)) {
        upcomingGoalIds.add(g.id);
        upcomingGoals.push(g);
      }
    }
  }

  const handleLog = useCallback(
    (goal: GoalMeta, date: Date) => {
      setSelectedDate(date);
      setCheckinGoal({ ...goal, goalTasks: tasksByGoal.get(goal.id) ?? [] });
    },
    [tasksByGoal]
  );

  const handleSaved = (date: Date, newIds: string[]) => {
    const key = format(date, "yyyy-MM-dd");
    setOverrides((prev) => new Map(prev).set(key, newIds));
    router.refresh();
  };

  const hasAnyGoals = goals.length > 0 && tasks.length > 0;

  return (
    <div className="space-y-5 animate-page-in">

      {/* ── Month strip ─────────────────────────────────── */}
      <MonthStrip
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
        weekStart={weekStart}
        onPrevWeek={() => setWeekStart(subWeeks(weekStart, 1))}
        onNextWeek={() => setWeekStart(addWeeks(weekStart, 1))}
        allLogs={allLogs}
      />

      {/* ── Day mood logger ─────────────────────────────── */}
      <DayMoodPanel
        date={selectedDate}
        existingLog={logMap.get(format(selectedDate, "yyyy-MM-dd"))}
        onSaved={() => router.refresh()}
      />

      {/* ── Today ───────────────────────────────────────── */}
      <section>
        <p className="section-label mb-3">
          Today — {format(today, "MMMM d")}
        </p>
        {todayGoals.length === 0 ? (
          <div className="panel-shell flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-3xl">📅</p>
            <p className="text-sm font-medium text-ink">No events scheduled today</p>
            <p className="text-xs text-ink-soft">
              Add intentions to your goals to see them here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayGoals.map((goal) => (
              <EventCard
                key={goal.id}
                goal={goal}
                isLogged={isGoalLogged(goal, today)}
                onLog={() => handleLog(goal, today)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── This week ───────────────────────────────────── */}
      {weekSections.length > 0 && (
        <section>
          <p className="section-label mb-3">This week</p>
          <div className="space-y-4">
            {weekSections.map(({ date, dayGoals }) => (
              <div key={format(date, "yyyy-MM-dd")}>
                <p className="mb-1.5 px-0.5 text-xs font-semibold text-ink-muted">
                  {format(date, "EEEE, d MMM")}
                </p>
                <div className="space-y-2">
                  {dayGoals.map((goal) => (
                    <EventCard
                      key={goal.id}
                      goal={goal}
                      isLogged={isGoalLogged(goal, date)}
                      onLog={() => handleLog(goal, date)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Upcoming ────────────────────────────────────── */}
      {upcomingGoals.length > 0 && (
        <section>
          <p className="section-label mb-3">Upcoming</p>
          <div className="space-y-2">
            {upcomingGoals.map((goal) => (
              <EventCard
                key={goal.id}
                goal={goal}
                isLogged={false}
                dateLabel="Next week"
                onLog={() => {}}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Empty state (no goals at all) ───────────────── */}
      {!hasAnyGoals && (
        <div className="panel-shell flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-4xl">🌟</p>
          <p className="text-base font-semibold text-ink">No events scheduled</p>
          <p className="text-sm text-ink-muted">
            Add intentions to your goals to see them here.
          </p>
        </div>
      )}

      {/* ── Check-in sheet ──────────────────────────────── */}
      {checkinGoal && (
        <CheckinSheet
          goal={checkinGoal}
          selectedDate={selectedDate}
          allLogs={allLogs}
          existingCompletedIds={getCompletedIds(selectedDate)}
          onClose={() => setCheckinGoal(null)}
          onSaved={(newIds) => handleSaved(selectedDate, newIds)}
        />
      )}
    </div>
  );
}
