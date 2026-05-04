"use client";

// src/app/calendar/calendar-view.tsx
// Calendar + intention checklist + mood/sleep prompt flow:
//  - Month strip with week scroll; clicking a day shows that day's mood+sleep summary
//  - Goal cards expand inline to reveal their intentions as a checkable task list
//  - After completing intentions today: auto-prompts mood + sleep (required fields)
//  - Navigation guard: intercepts any link click while mood/sleep unlogged today
//  - Once mood+sleep saved for the day, prompt never shows again for that date

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  format, startOfWeek, endOfWeek, addWeeks, subWeeks,
  addDays, subDays, isToday, isSameDay, parseISO,
  eachDayOfInterval,
} from "date-fns";
import {
  ChevronLeft, ChevronRight, X, Camera, Flame, Check,
  ChevronDown, ChevronUp, Moon, Smile,
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

// ─── Constants ────────────────────────────────────────────────────────────────

const MOODS = [
  { value: "energized", label: "Energized", emoji: "🌟" },
  { value: "focused",   label: "Focused",   emoji: "🎯" },
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
    if (!taskIds.some((tid) => log.completedTaskIds.includes(tid))) break;
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

function skipKey(dateKey: string) { return `mood_sleep_skip_${dateKey}`; }

// ─── MoodSleepPrompt ──────────────────────────────────────────────────────────
// Dark overlay modal — required fields before leaving the calendar

function MoodSleepPrompt({
  dateKey,
  existingLog,
  onSaved,
  onSkip,
}: {
  dateKey: string;
  existingLog: DailyLog | undefined;
  onSaved: (mood: string, sleep: string) => void;
  onSkip: () => void;
}) {
  const [mood,  setMood]  = useState(existingLog?.mood  ?? "");
  const [sleep, setSleep] = useState(existingLog?.sleep ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!mood || !sleep) {
      toast("Please pick your mood and sleep", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/daily-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateKey,
          mood,
          sleep,
          completedTaskIds: existingLog?.completedTaskIds ?? [],
        }),
      });
      if (!res.ok) throw new Error();
      toast("Day logged ✓");
      onSaved(mood, sleep);
    } catch {
      toast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onSkip} />
      <div
        className="relative w-full max-w-sm rounded-t-[2rem] sm:rounded-[2rem] bg-[#13110F] text-white shadow-2xl"
        style={{ maxHeight: "90dvh" }}
      >
        <div className="overflow-y-auto p-6" style={{ maxHeight: "90dvh" }}>
          {/* Drag handle */}
          <div className="flex justify-center mb-4 sm:hidden">
            <div className="h-1 w-10 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#C4963A]/15">
              <Moon className="h-7 w-7 text-[#C4963A]" />
            </div>
            <p className="text-lg font-bold text-white">Complete your day</p>
            <p className="mt-1 text-sm text-white/50">
              Mood and sleep are required to track your wellbeing.
            </p>
          </div>

          {/* Mood */}
          <div className="mb-5">
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">
              How was your mood? <span className="text-[#C4963A]">*</span>
            </p>
            <div className="grid grid-cols-4 gap-2">
              {MOODS.slice(0, 4).map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMood(m.value === mood ? "" : m.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-2xl py-3 border transition-all",
                    mood === m.value
                      ? "border-[#C4963A]/60 bg-[#C4963A]/12"
                      : "border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08]"
                  )}
                >
                  <span className="text-xl leading-none">{m.emoji}</span>
                  <span className={cn(
                    "text-[10px] font-semibold",
                    mood === m.value ? "text-[#C4963A]" : "text-white/40"
                  )}>{m.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {MOODS.slice(4).map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMood(m.value === mood ? "" : m.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-2xl py-3 border transition-all",
                    mood === m.value
                      ? "border-[#C4963A]/60 bg-[#C4963A]/12"
                      : "border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08]"
                  )}
                >
                  <span className="text-xl leading-none">{m.emoji}</span>
                  <span className={cn(
                    "text-[10px] font-semibold",
                    mood === m.value ? "text-[#C4963A]" : "text-white/40"
                  )}>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sleep */}
          <div className="mb-6">
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">
              How much did you sleep? <span className="text-[#C4963A]">*</span>
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {SLEEP.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSleep(s.value === sleep ? "" : s.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-2xl py-3 border transition-all",
                    sleep === s.value
                      ? "border-[#C4963A]/60 bg-[#C4963A]/12"
                      : "border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08]"
                  )}
                >
                  <span className="text-xl leading-none">{s.emoji}</span>
                  <span className={cn(
                    "text-[9px] font-semibold",
                    sleep === s.value ? "text-[#C4963A]" : "text-white/40"
                  )}>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !mood || !sleep}
            className="w-full rounded-2xl bg-[#C4963A] py-4 text-sm font-bold text-[#13110F] disabled:opacity-50 transition-opacity hover:opacity-90"
          >
            {saving ? "Saving…" : "Save & continue"}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="mt-3 w-full rounded-2xl py-2.5 text-sm font-medium text-white/35 hover:text-white/55 transition-colors"
          >
            Remind me later
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DayMoodSummary ───────────────────────────────────────────────────────────
// Shown below MonthStrip when a day is selected

function DayMoodSummary({
  date,
  log,
  onLogNow,
}: {
  date: Date;
  log: DailyLog | undefined;
  onLogNow: () => void;
}) {
  const isTodayDate = isToday(date);
  const hasMoodSleep = !!(log?.mood && log?.sleep);

  const mood  = MOODS.find((m) => m.value === log?.mood);
  const sleep = SLEEP.find((s) => s.value === log?.sleep);

  if (hasMoodSleep) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-cream-dark bg-cream-paper px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-lg leading-none">{mood?.emoji}</span>
          <span className="text-sm font-medium text-ink">{mood?.label}</span>
        </div>
        <span className="text-cream-dark">·</span>
        <div className="flex items-center gap-1.5">
          <span className="text-lg leading-none">{sleep?.emoji}</span>
          <span className="text-sm font-medium text-ink">{sleep?.label}</span>
        </div>
        <span className="ml-auto text-xs text-ink-muted">{format(date, "MMM d")}</span>
      </div>
    );
  }

  if (isTodayDate) {
    return (
      <button
        type="button"
        onClick={onLogNow}
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-gold/40 bg-gold/5 px-4 py-3 text-left transition-all hover:border-gold/60 hover:bg-gold/8"
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gold/15">
          <Moon className="h-4 w-4 text-gold" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">Log today&apos;s mood &amp; sleep</p>
          <p className="text-xs text-ink-muted">Required daily · Takes 10 seconds</p>
        </div>
        <ChevronRight className="ml-auto h-4 w-4 flex-shrink-0 text-ink-muted" />
      </button>
    );
  }

  return null;
}

// ─── GoalIntentionPanel ───────────────────────────────────────────────────────
// Goal card that expands to show its intentions as a checkable task list

function GoalIntentionPanel({
  goal,
  tasks,
  completedIds,
  onSaved,
  onNeedsMoodSleep,
  date,
  allLogs,
  isToday: isTodayDate,
}: {
  goal: GoalMeta;
  tasks: GoalTask[];
  completedIds: Set<string>;
  onSaved: (newIds: string[]) => void;
  onNeedsMoodSleep: () => void;
  date: Date;
  allLogs: DailyLog[];
  isToday: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [localIds, setLocalIds] = useState<Set<string>>(new Set(completedIds));
  const [note, setNote]         = useState("");
  const [photo, setPhoto]       = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dateKey = format(date, "yyyy-MM-dd");

  // Sync completedIds from parent when it changes
  useEffect(() => { setLocalIds(new Set(completedIds)); }, [completedIds]);

  const doneTasks  = tasks.filter((t) => localIds.has(t.id)).length;
  const totalTasks = tasks.length;
  const allDone    = totalTasks > 0 && doneTasks === totalTasks;
  const streak     = calcGoalStreak(tasks.map((t) => t.id), allLogs);

  const toggleTask = (taskId: string) => {
    setLocalIds((prev) => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  };

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
    const newIds = Array.from(localIds);

    // Merge with any other goals' completed IDs from the existing log
    const existingLog = allLogs.find((l) => l.date === dateKey);
    const merged = Array.from(new Set([...(existingLog?.completedTaskIds ?? []), ...newIds]));

    try {
      const body: Record<string, unknown> = {
        date: dateKey,
        completedTaskIds: merged,
        dailyIntentions: [
          { id: `ci_${goal.id}`, text: `${goal.title} check-in`, done: doneTasks > 0 },
        ],
      };
      if (note) body.reflection = note;
      const res = await fetch("/api/daily-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast(`${goal.emoji ?? "⭐"} Progress saved!`);
      onSaved(merged);
      setExpanded(false);

      // After saving tasks today: if no mood/sleep logged, prompt
      if (isTodayDate && doneTasks > 0) {
        const log = allLogs.find((l) => l.date === dateKey);
        if (!log?.mood || !log?.sleep) {
          setTimeout(onNeedsMoodSleep, 300);
        }
      }
    } catch {
      toast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn(
      "overflow-hidden rounded-xl border transition-all",
      expanded ? "border-ink/20 shadow-sm" : "border-cream-dark bg-cream-paper hover:shadow-sm"
    )}>
      {/* Left accent bar + header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-0 text-left"
      >
        <div className="w-[3.5px] self-stretch flex-shrink-0" style={{ background: goal.color }} />
        <div className="flex flex-1 items-center gap-3 px-3.5 py-3.5">
          <span className="flex-shrink-0 text-xl leading-none">{goal.emoji ?? "⭐"}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{goal.title}</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {totalTasks} intention{totalTasks !== 1 ? "s" : ""}
              {streak > 0 && <span className="ml-2 text-orange-500">🔥 {streak}-day streak</span>}
            </p>
          </div>
          {/* Progress badge */}
          <div className="flex flex-shrink-0 items-center gap-2">
            {allDone ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                <Check className="h-3 w-3" /> Done
              </span>
            ) : (
              <span className="rounded-full bg-cream-dark px-2.5 py-1 text-xs font-semibold text-ink-muted">
                {doneTasks}/{totalTasks}
              </span>
            )}
            {expanded
              ? <ChevronUp className="h-4 w-4 text-ink-muted" />
              : <ChevronDown className="h-4 w-4 text-ink-muted" />
            }
          </div>
        </div>
      </button>

      {/* Expanded: intention checklist */}
      {expanded && (
        <div className="border-t border-cream-dark">
          {/* Progress bar */}
          <div className="h-[2px] bg-cream-dark">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0}%`,
                background: goal.color,
              }}
            />
          </div>

          {/* Task list */}
          <div className="divide-y divide-cream-dark/50">
            {tasks.map((task) => {
              const done = localIds.has(task.id);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => toggleTask(task.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors",
                    done ? "bg-emerald-500/4" : "hover:bg-cream-dark/30"
                  )}
                >
                  <div className={cn(
                    "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all",
                    done
                      ? "border-emerald-500 bg-emerald-500"
                      : "border-ink-muted/40"
                  )}>
                    {done && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </div>
                  <span className={cn(
                    "flex-1 text-sm leading-snug",
                    done ? "text-ink-muted line-through" : "text-ink"
                  )}>
                    {task.text}
                  </span>
                  {task.isRepeating && (
                    <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink-muted/40">
                      Daily
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Note + photo + save */}
          <div className="px-4 pb-4 pt-3 space-y-3 bg-cream/50">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional)…"
              rows={2}
              className="w-full resize-none rounded-xl border border-cream-dark bg-cream-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-ink-muted/60"
            />

            <div className="flex items-center gap-2">
              {/* Photo */}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
              {photo ? (
                <div className="relative h-10 w-10 overflow-hidden rounded-lg">
                  <img src={photo} alt="note" className="h-full w-full object-cover" />
                  <button
                    onClick={() => { setPhoto(null); try { localStorage.removeItem(`ci_photo_${goal.id}_${dateKey}`); } catch {} }}
                    className="absolute inset-0 flex items-center justify-center bg-black/40"
                  >
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-dashed border-cream-dark text-ink-muted hover:border-ink-muted/60 transition-colors"
                >
                  <Camera className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: goal.color, color: "#fff" }}
              >
                {saving ? "Saving…" : allDone ? "✓ Save progress" : "Save progress"}
              </button>
            </div>
          </div>
        </div>
      )}
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

      <div className="px-3 pb-3 pt-2">
        <div className="grid grid-cols-7 gap-1">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div key={i} className="py-1 text-center text-[10px] font-bold uppercase tracking-wider text-ink-muted">{d}</div>
          ))}
          {weekDays.map((day) => {
            const key        = format(day, "yyyy-MM-dd");
            const log        = logMap.get(key);
            const isSelected = isSameDay(day, selectedDate);
            const isTodayDay = isToday(day);
            const hasMoodSleep = !!(log?.mood && log?.sleep);
            const hasActivity  = !!(log?.completedTaskIds?.length);

            return (
              <button
                key={key}
                onClick={() => onSelect(day)}
                className={cn(
                  "relative flex flex-col items-center gap-1 rounded-xl py-2.5 transition-all",
                  isSelected ? "bg-ink" : isTodayDay ? "bg-gold/10" : "hover:bg-cream-dark/40"
                )}
              >
                <span className={cn(
                  "text-sm font-semibold leading-none",
                  isSelected ? "text-cream-paper" : isTodayDay ? "text-gold" : "text-ink"
                )}>
                  {format(day, "d")}
                </span>
                {/* Dot indicators */}
                <div className="flex gap-0.5">
                  {hasMoodSleep && (
                    <div className={cn(
                      "h-1 w-1 rounded-full",
                      isSelected ? "bg-gold" : "bg-gold"
                    )} />
                  )}
                  {hasActivity && (
                    <div className={cn(
                      "h-1 w-1 rounded-full",
                      isSelected ? "bg-emerald-300" : "bg-emerald-500"
                    )} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── CalendarView ─────────────────────────────────────────────────────────────

export function CalendarView({ tasks, goals, allLogs }: CalendarViewProps) {
  const router = useRouter();

  const [weekStart, setWeekStart]   = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showMoodPrompt, setShowMoodPrompt] = useState(false);

  // Live overrides: date → merged completedTaskIds (updated after each save)
  const [overrides, setOverrides] = useState<Map<string, string[]>>(() => {
    const m = new Map<string, string[]>();
    for (const l of allLogs) m.set(l.date, l.completedTaskIds);
    return m;
  });

  // Track saved mood/sleep per date in this session
  const [savedMoodSleep, setSavedMoodSleep] = useState<Map<string, { mood: string; sleep: string }>>(() => {
    const m = new Map<string, { mood: string; sleep: string }>();
    for (const l of allLogs) {
      if (l.mood && l.sleep) m.set(l.date, { mood: l.mood, sleep: l.sleep });
    }
    return m;
  });

  // ── Computed ──────────────────────────────────────────────────────────────
  const logMap = new Map(allLogs.map((l) => [l.date, l]));

  const tasksByGoal = new Map<string, GoalTask[]>();
  for (const task of tasks) {
    const arr = tasksByGoal.get(task.goalId) ?? [];
    arr.push(task);
    tasksByGoal.set(task.goalId, arr);
  }

  const todayKey = format(new Date(), "yyyy-MM-dd");

  function isTodayMoodSleepLogged(): boolean {
    if (savedMoodSleep.has(todayKey)) return true;
    const log = logMap.get(todayKey);
    return !!(log?.mood && log?.sleep);
  }

  function hasTodayCompletions(): boolean {
    const ids = overrides.get(todayKey) ?? logMap.get(todayKey)?.completedTaskIds ?? [];
    return ids.length > 0;
  }

  function needsMoodSleepPrompt(): boolean {
    return hasTodayCompletions() && !isTodayMoodSleepLogged();
  }

  // ── Navigation guard ───────────────────────────────────────────────────────
  // Intercept link/button clicks to other pages while on /calendar
  useEffect(() => {
    // Update global flag so sidebar can check it
    (window as unknown as Record<string, unknown>)._calendarNeedsMoodSleep = needsMoodSleepPrompt();
  });

  useEffect(() => {
    // beforeunload: browser close / refresh
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (needsMoodSleepPrompt()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    // In-app link interception (capture phase catches <a> clicks before Next.js routing)
    const handleClick = (e: MouseEvent) => {
      if (!needsMoodSleepPrompt()) return;
      const anchor = (e.target as HTMLElement).closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (href === "/calendar" || href.startsWith("/calendar?") || href.startsWith("#")) return;
      e.preventDefault();
      e.stopPropagation();
      setShowMoodPrompt(true);
    };

    // Listen for external trigger (sidebar button dispatch)
    const handleExternalTrigger = () => {
      if (needsMoodSleepPrompt()) setShowMoodPrompt(true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleClick, true);
    window.addEventListener("northstar:show-mood-sleep-prompt", handleExternalTrigger);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("northstar:show-mood-sleep-prompt", handleExternalTrigger);
    };
  });

  // ── Prompt on load if already has completions but no mood/sleep ────────────
  useEffect(() => {
    const skipDate = localStorage.getItem(skipKey(todayKey));
    if (skipDate === todayKey) return;
    if (!needsMoodSleepPrompt()) return;
    const t = setTimeout(() => setShowMoodPrompt(true), 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function getCompletedIds(date: Date): Set<string> {
    const key = format(date, "yyyy-MM-dd");
    return new Set(overrides.get(key) ?? logMap.get(key)?.completedTaskIds ?? []);
  }

  function getActiveGoals(date: Date): GoalMeta[] {
    return goals.filter(
      (g) => goalActiveOnDay(g, date) && (tasksByGoal.get(g.id)?.length ?? 0) > 0
    );
  }

  const handleSaved = (date: Date, newIds: string[]) => {
    const key = format(date, "yyyy-MM-dd");
    setOverrides((prev) => new Map(prev).set(key, newIds));
    router.refresh();
  };

  const handleMoodSleepSaved = (mood: string, sleep: string) => {
    setSavedMoodSleep((prev) => new Map(prev).set(todayKey, { mood, sleep }));
    setShowMoodPrompt(false);
    router.refresh();
  };

  const handleMoodSleepSkip = () => {
    try { localStorage.setItem(skipKey(todayKey), todayKey); } catch {}
    setShowMoodPrompt(false);
  };

  // ── Build sections ─────────────────────────────────────────────────────────
  const today = new Date();
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const todayGoals = getActiveGoals(today);

  const weekSections: { date: Date; dayGoals: GoalMeta[] }[] = [];
  for (let i = 1; i <= 6; i++) {
    const d = addDays(today, i);
    if (d > weekEnd) break;
    const dayGoals = getActiveGoals(d);
    if (dayGoals.length > 0) weekSections.push({ date: d, dayGoals });
  }

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

  const hasAnyGoals = goals.length > 0 && tasks.length > 0;
  const selectedKey = format(selectedDate, "yyyy-MM-dd");
  const selectedLog = logMap.get(selectedKey);

  // Merge saved mood/sleep into selectedLog for display
  const displayLog = selectedLog
    ? {
        ...selectedLog,
        mood: savedMoodSleep.get(selectedKey)?.mood ?? selectedLog.mood,
        sleep: savedMoodSleep.get(selectedKey)?.sleep ?? selectedLog.sleep,
      }
    : undefined;

  return (
    <div className="space-y-4 animate-page-in">

      {/* ── Month strip ───────────────────────────────────── */}
      <MonthStrip
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
        weekStart={weekStart}
        onPrevWeek={() => setWeekStart(subWeeks(weekStart, 1))}
        onNextWeek={() => setWeekStart(addWeeks(weekStart, 1))}
        allLogs={allLogs}
      />

      {/* ── Selected day mood/sleep summary ───────────────── */}
      <DayMoodSummary
        date={selectedDate}
        log={displayLog as DailyLog | undefined}
        onLogNow={() => setShowMoodPrompt(true)}
      />

      {/* ── Today ─────────────────────────────────────────── */}
      <section>
        <p className="section-label mb-3">Today — {format(today, "MMMM d")}</p>
        {todayGoals.length === 0 ? (
          <div className="panel-shell flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-3xl">📅</p>
            <p className="text-sm font-medium text-ink">No goals scheduled today</p>
            <p className="text-xs text-ink-soft">Add intentions to your goals to see them here.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {todayGoals.map((goal) => (
              <GoalIntentionPanel
                key={goal.id}
                goal={goal}
                tasks={tasksByGoal.get(goal.id) ?? []}
                completedIds={getCompletedIds(today)}
                onSaved={(newIds) => handleSaved(today, newIds)}
                onNeedsMoodSleep={() => setShowMoodPrompt(true)}
                date={today}
                allLogs={allLogs}
                isToday={true}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── This week ─────────────────────────────────────── */}
      {weekSections.length > 0 && (
        <section>
          <p className="section-label mb-3">This week</p>
          <div className="space-y-4">
            {weekSections.map(({ date, dayGoals }) => (
              <div key={format(date, "yyyy-MM-dd")}>
                <p className="mb-2 px-0.5 text-xs font-semibold text-ink-muted">
                  {format(date, "EEEE, d MMM")}
                </p>
                <div className="space-y-2">
                  {dayGoals.map((goal) => (
                    <GoalIntentionPanel
                      key={goal.id}
                      goal={goal}
                      tasks={tasksByGoal.get(goal.id) ?? []}
                      completedIds={getCompletedIds(date)}
                      onSaved={(newIds) => handleSaved(date, newIds)}
                      onNeedsMoodSleep={() => {}}
                      date={date}
                      allLogs={allLogs}
                      isToday={false}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Upcoming ──────────────────────────────────────── */}
      {upcomingGoals.length > 0 && (
        <section>
          <p className="section-label mb-3">Upcoming</p>
          <div className="space-y-2">
            {upcomingGoals.map((goal) => (
              <div
                key={goal.id}
                className="flex items-center gap-3 overflow-hidden rounded-xl border border-cream-dark bg-cream-paper px-3.5 py-3 opacity-60"
              >
                <div className="w-[3.5px] self-stretch flex-shrink-0 rounded-full" style={{ background: goal.color }} />
                <span className="text-xl leading-none">{goal.emoji ?? "⭐"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{goal.title}</p>
                  <p className="text-xs text-ink-muted">Next week · {(tasksByGoal.get(goal.id) ?? []).length} intentions</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Empty state ───────────────────────────────────── */}
      {!hasAnyGoals && (
        <div className="panel-shell flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-4xl">🌟</p>
          <p className="text-base font-semibold text-ink">No intentions scheduled</p>
          <p className="text-sm text-ink-muted">
            When you create goals with intentions, they&apos;ll appear here.
          </p>
        </div>
      )}

      {/* ── Mood/Sleep prompt modal ───────────────────────── */}
      {showMoodPrompt && (
        <MoodSleepPrompt
          dateKey={todayKey}
          existingLog={logMap.get(todayKey)}
          onSaved={handleMoodSleepSaved}
          onSkip={handleMoodSleepSkip}
        />
      )}
    </div>
  );
}
