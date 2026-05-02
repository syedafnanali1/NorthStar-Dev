"use client";

// src/app/goals/new/new-goal-wizard.tsx
// 5-step goal creation wizard matching spec §05:
//   Step 1 — Name + icon + category
//   Step 2 — Deadline (presets + calendar)
//   Step 3 — Solo or Group
//   Step 4 — Intentions / schedule
//   Step 5 — Review & Save

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Sparkles, Lock, X, Plus, Check, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import { DecomposeModal, type DecomposedGoal } from "@/components/ai/decompose-modal";
import {
  inferGoalSmartSuggestion,
  ensureSmartGoalTasks,
  computeCadenceTarget,
  makeAutoTaskSuggestion,
  type MoneyCadence,
} from "@/lib/goal-intelligence";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "health" | "finance" | "writing" | "body" | "mindset" | "custom";

interface Intention {
  id: string;
  label: string;
  days: string[];   // ["Mon", "Wed", "Fri"]
  time: string;     // "06:30"
  duration: number; // minutes
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: Category; label: string; emoji: string; color: string }[] = [
  { value: "health",  label: "Health",   emoji: "🏃", color: "#6B8C7A" },
  { value: "finance", label: "Finance",  emoji: "💰", color: "#5B7EA6" },
  { value: "writing", label: "Writing",  emoji: "✍️", color: "#C4963A" },
  { value: "body",    label: "Body",     emoji: "⚖️", color: "#B5705B" },
  { value: "mindset", label: "Learning", emoji: "🧠", color: "#7B6FA0" },
  { value: "custom",  label: "Custom",   emoji: "⭐", color: "#C4963A" },
];

const CATEGORY_EMOJIS: Record<Category, string[]> = {
  health:  ["🏃", "💪", "🚴", "🧘", "🏊", "⚽"],
  finance: ["💰", "📈", "🏦", "💳", "🎯", "📊"],
  writing: ["✍️", "📝", "📖", "🖊️", "📚", "🎨"],
  body:    ["⚖️", "🥗", "💪", "🏋️", "🧘", "🥑"],
  mindset: ["🧠", "📚", "🎓", "🔬", "💡", "🎯"],
  custom:  ["⭐", "🎯", "🔥", "✨", "🚀", "💫"],
};

const DEADLINE_PRESETS = [
  { label: "1 week",    days: 7 },
  { label: "1 month",   days: 30 },
  { label: "3 months",  days: 90 },
  { label: "6 months",  days: 180 },
];

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function toInputDate(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

function daysFromNow(date: Date): number {
  return Math.round((date.getTime() - Date.now()) / 86400000);
}

function nanoid6() {
  return Math.random().toString(36).slice(2, 8);
}

// ─── Mini calendar ────────────────────────────────────────────────────────────

function MiniCalendar({ selected, onSelect }: { selected: Date | null; onSelect: (d: Date) => void }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // Adjust to Mon-first
  const startOffset = (firstDay + 6) % 7;
  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  return (
    <div className="rounded-2xl border border-cream-dark bg-cream p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-cream-dark transition">
          <ChevronLeft className="h-4 w-4 text-ink-muted" />
        </button>
        <span className="text-sm font-semibold text-ink">{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button type="button" onClick={nextMonth} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-cream-dark transition">
          <ChevronRight className="h-4 w-4 text-ink-muted" />
        </button>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {["M","T","W","T","F","S","S"].map((d, i) => (
          <span key={i} className="text-center text-[10px] font-semibold text-ink-muted py-1">{d}</span>
        ))}
      </div>
      {/* Cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const date = new Date(viewYear, viewMonth, day);
          const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const isSelected = selected && date.toDateString() === selected.toDateString();
          return (
            <button key={i} type="button" disabled={isPast}
              onClick={() => onSelect(date)}
              className={cn(
                "flex h-8 w-full items-center justify-center rounded-lg text-sm transition",
                isPast ? "text-ink-muted/30 cursor-not-allowed" : "hover:bg-cream-dark cursor-pointer",
                isSelected ? "bg-gold text-white font-semibold hover:bg-gold/90" : "text-ink"
              )}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-all duration-400",
          i < step ? "bg-gold" : i === step - 1 ? "bg-gold" : "bg-cream-dark")} />
      ))}
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function NewGoalWizard({ hasPremiumAI = false }: { hasPremiumAI?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [decomposeOpen, setDecomposeOpen] = useState(false);
  const [showAILock, setShowAILock] = useState(false);

  // Step 1
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [emoji, setEmoji] = useState("⭐");

  // Step 2
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [presetIdx, setPresetIdx] = useState<number | null>(1); // default 1 month
  const [showCalendar, setShowCalendar] = useState(false);

  // Step 3
  const [goalType, setGoalType] = useState<"solo" | "group">("solo");

  // Step 4
  const [intentions, setIntentions] = useState<Intention[]>([]);
  const [newIntentionLabel, setNewIntentionLabel] = useState("Morning session");
  const [newIntentionTime, setNewIntentionTime] = useState("07:00");
  const [newIntentionDuration, setNewIntentionDuration] = useState(30);
  const [newIntentionDays, setNewIntentionDays] = useState<string[]>(["Mon", "Wed", "Fri"]);
  const [addingIntention, setAddingIntention] = useState(false);

  // Smart detection
  const smartSuggestion = useMemo(
    () => inferGoalSmartSuggestion(title, "", category),
    [title, category]
  );

  // Auto-detect category from title
  useEffect(() => {
    if (!category && title.trim().length >= 3) {
      setCategory(smartSuggestion.category);
      setEmoji(CATEGORY_EMOJIS[smartSuggestion.category]?.[0] ?? "⭐");
    }
  }, [title, smartSuggestion.category, category]);

  // Default deadline to 1 month when first entering step 2
  useEffect(() => {
    if (step === 2 && !deadline) {
      setDeadline(addDays(new Date(), 30));
    }
  }, [step, deadline]);

  // ── AI handlers ──────────────────────────────────────────────────────────────

  function handleAIClick() {
    if (hasPremiumAI) setDecomposeOpen(true);
    else setShowAILock((v) => !v);
  }

  function applyDecomposed(goal: DecomposedGoal) {
    setTitle(goal.title);
    setCategory(goal.category);
    setEmoji(CATEGORY_EMOJIS[goal.category]?.[0] ?? "⭐");
    if (goal.suggestedEndDate) setDeadline(new Date(goal.suggestedEndDate));
    if (goal.suggestedTasks.length > 0) {
      setIntentions(goal.suggestedTasks.slice(0, 3).map((t) => ({
        id: nanoid6(),
        label: t,
        days: ["Mon", "Wed", "Fri"],
        time: "07:00",
        duration: 30,
      })));
    }
    toast("Goal pre-filled by AI ✨");
    setStep(2);
  }

  // ── Intention helpers ──────────────────────────────────────────────────────

  function addIntention() {
    if (!newIntentionLabel.trim() || newIntentionDays.length === 0) return;
    setIntentions((prev) => [...prev, {
      id: nanoid6(),
      label: newIntentionLabel.trim(),
      days: newIntentionDays,
      time: newIntentionTime,
      duration: newIntentionDuration,
    }]);
    setAddingIntention(false);
    setNewIntentionLabel("Morning session");
    setNewIntentionTime("07:00");
    setNewIntentionDuration(30);
    setNewIntentionDays(["Mon", "Wed", "Fri"]);
  }

  function removeIntention(id: string) {
    setIntentions((prev) => prev.filter((i) => i.id !== id));
  }

  function toggleDay(day: string) {
    setNewIntentionDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  }

  function formatTime(t: string): string {
    const [h, m] = t.split(":").map(Number);
    if (h === undefined || m === undefined) return t;
    const ampm = h! >= 12 ? "pm" : "am";
    const hour = h! % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")}${ampm}`;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!title.trim() || title.trim().length < 3) { toast("Please enter a goal title", "error"); return; }
    setSubmitting(true);
    try {
      const resolvedCategory = category ?? smartSuggestion.category;
      const tasks = intentions.length > 0
        ? intentions.map((i) => ({ text: i.label, isRepeating: true, incrementValue: undefined }))
        : ensureSmartGoalTasks({ title: title.trim(), intent: smartSuggestion.intent, unit: null, amount: null, cadence: "daily" as MoneyCadence, startDate: null, endDate: deadline ? toInputDate(deadline) : null, targetValue: null, tasks: [] }).map((t) => ({ text: t.text, isRepeating: true, incrementValue: t.incrementValue }));

      const response = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category: resolvedCategory,
          color: CATEGORIES.find((c) => c.value === resolvedCategory)?.color ?? "#C4963A",
          emoji,
          endDate: deadline ? toInputDate(deadline) : undefined,
          isPublic: goalType === "group",
          tasks,
          milestones: [],
        }),
      });

      if (!response.ok) {
        const err = (await response.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to create goal");
      }

      toast("Goal created! ⭐");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create goal", "error");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const resolvedCategory = category ?? smartSuggestion.category;
  const categoryData = CATEGORIES.find((c) => c.value === resolvedCategory);

  return (
    <>
      {/* Progress + step label */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between text-xs text-ink-muted font-medium">
          <span>Step {step} of 5</span>
          <span>{["Name", "Deadline", "Type", "Intentions", "Review"][step - 1]}</span>
        </div>
        <StepBar step={step} total={5} />
      </div>

      <div className="panel-shell p-5 sm:p-6 space-y-6">

        {/* ── Step 1: Name + icon + category ──────────────────────────── */}
        {step === 1 && (
          <>
            <div>
              <h2 className="text-2xl font-serif font-semibold text-ink">What&apos;s your goal?</h2>
              <p className="mt-1 text-sm text-ink-muted">Be specific — tap to edit anytime</p>
            </div>

            {/* AI button */}
            <div>
              <button type="button" onClick={handleAIClick}
                className={cn("w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
                  hasPremiumAI ? "border-gold/40 bg-gold/5 hover:bg-gold/10" : "border-cream-dark bg-cream hover:border-ink-muted/30")}>
                {hasPremiumAI ? <Sparkles className="h-4 w-4 text-gold shrink-0" /> : <Lock className="h-4 w-4 text-ink-muted shrink-0" />}
                <span className={cn("text-sm font-semibold", hasPremiumAI ? "text-gold" : "text-ink-muted")}>
                  {hasPremiumAI ? "Generate with AI" : "Generate with AI"}
                  {!hasPremiumAI && <span className="ml-2 text-[10px] font-semibold text-ink-muted/60 uppercase tracking-wider">Premium</span>}
                </span>
              </button>
              {showAILock && !hasPremiumAI && (
                <div className="mt-2 rounded-2xl border border-gold/25 bg-gold/5 p-4 flex gap-3 items-start">
                  <Lock className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">AI Goal Creation is Premium</p>
                    <p className="mt-1 text-xs text-ink-muted leading-5">Describe your goal in plain language — Claude generates milestones, habits, and a target.</p>
                    <div className="mt-3 flex gap-2">
                      <a href="/premium" className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3 py-1.5 text-xs font-semibold text-ink hover:opacity-90 transition">
                        <Sparkles className="h-3 w-3" />Unlock Premium
                      </a>
                      <button type="button" onClick={() => setShowAILock(false)} className="rounded-xl border border-cream-dark px-3 py-1.5 text-xs text-ink-muted hover:text-ink transition">Dismiss</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Title input */}
            <div className="space-y-2">
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setCategory(null); }}
                placeholder="e.g. Run a 5K"
                maxLength={120}
                className="form-input min-h-[56px] rounded-2xl text-lg font-medium"
                autoFocus
              />
              {category && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-cream-dark bg-cream px-2.5 py-1 text-xs font-semibold text-ink-muted">
                    {categoryData?.emoji} {categoryData?.label} detected
                  </span>
                </div>
              )}
            </div>

            {/* Emoji picker */}
            <div className="space-y-2">
              <label className="form-label">Choose icon</label>
              <div className="flex gap-2 flex-wrap">
                {(CATEGORY_EMOJIS[resolvedCategory] ?? CATEGORY_EMOJIS.custom).map((e) => (
                  <button key={e} type="button" onClick={() => setEmoji(e)}
                    className={cn("flex h-10 w-10 items-center justify-center rounded-xl border text-xl transition",
                      emoji === e ? "border-gold bg-gold/10" : "border-cream-dark bg-cream hover:border-ink-muted/40")}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Category chips */}
            <div className="space-y-2">
              <label className="form-label">Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button key={cat.value} type="button"
                    onClick={() => { setCategory(cat.value); setEmoji(CATEGORY_EMOJIS[cat.value]?.[0] ?? "⭐"); }}
                    className={cn("rounded-full border px-3 py-1.5 text-sm font-medium transition",
                      category === cat.value ? "border-ink bg-ink text-cream-paper" : "border-cream-dark bg-cream text-ink-muted hover:border-ink-muted/50 hover:text-ink")}>
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* AI tip */}
            {title.length >= 3 && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-gold/20 bg-gold/5 px-4 py-3">
                <Sparkles className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                <p className="text-xs text-ink-muted leading-5">
                  <span className="font-semibold text-ink">Specific goals are 2× more likely to be completed</span> — be precise about your target and timeline.
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <button type="button"
                onClick={() => { if (!title.trim() || title.trim().length < 3) { toast("Enter a goal title first", "error"); return; } setStep(2); }}
                className="btn-primary min-h-[48px] rounded-2xl px-6">
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Deadline ─────────────────────────────────────────── */}
        {step === 2 && (
          <>
            <div>
              <h2 className="text-2xl font-serif font-semibold text-ink">When do you finish?</h2>
              <p className="mt-1 text-sm text-ink-muted">Pick a realistic timeframe</p>
            </div>

            {/* Preset pills */}
            <div className="flex gap-2 flex-wrap">
              {DEADLINE_PRESETS.map((p, i) => (
                <button key={p.label} type="button"
                  onClick={() => { setPresetIdx(i); setDeadline(addDays(new Date(), p.days)); setShowCalendar(false); }}
                  className={cn("rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                    presetIdx === i ? "border-gold bg-gold text-ink" : "border-cream-dark bg-cream text-ink-muted hover:border-ink-muted/40 hover:text-ink")}>
                  {p.label}
                </button>
              ))}
              <button type="button"
                onClick={() => { setPresetIdx(null); setShowCalendar(true); }}
                className={cn("rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                  presetIdx === null ? "border-gold bg-gold text-ink" : "border-cream-dark bg-cream text-ink-muted hover:border-ink-muted/40 hover:text-ink")}>
                Custom
              </button>
            </div>

            {/* Calendar (always shown for custom, optional for preset) */}
            {(showCalendar || presetIdx !== null) && (
              <MiniCalendar
                selected={deadline}
                onSelect={(d) => { setDeadline(d); setPresetIdx(null); setShowCalendar(true); }}
              />
            )}

            {deadline && (
              <div className="rounded-2xl border border-cream-dark bg-cream px-4 py-3">
                <p className="text-sm font-semibold text-ink">Goal ends: {formatDate(deadline)}</p>
                <p className="text-xs text-ink-muted mt-0.5">{daysFromNow(deadline)} days from today</p>
              </div>
            )}

            <div className="flex justify-between gap-3">
              <button type="button" onClick={() => setStep(1)} className="btn-secondary min-h-[48px] rounded-2xl px-5">
                <ArrowLeft className="h-4 w-4" />Back
              </button>
              <button type="button" onClick={() => setStep(3)} className="btn-primary min-h-[48px] rounded-2xl px-6">
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {/* ── Step 3: Solo or Group ────────────────────────────────────── */}
        {step === 3 && (
          <>
            <div>
              <h2 className="text-2xl font-serif font-semibold text-ink">Solo or with others?</h2>
              <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-gold/25 bg-gold/5 px-3 py-2">
                <Sparkles className="h-3.5 w-3.5 text-gold shrink-0" />
                <p className="text-xs font-medium text-ink-muted">Group goals complete <span className="font-bold text-ink">34% faster</span> with accountability!</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Solo */}
              <button type="button" onClick={() => setGoalType("solo")}
                className={cn("w-full flex items-center gap-4 rounded-2xl border p-4 text-left transition-all",
                  goalType === "solo" ? "border-ink bg-ink/5" : "border-cream-dark bg-cream hover:border-ink-muted/40")}>
                <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl",
                  goalType === "solo" ? "bg-ink/10" : "bg-cream-dark")}>
                  🙋
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink">Solo goal</p>
                  <p className="text-sm text-ink-muted">Private by default</p>
                </div>
                {goalType === "solo" && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold">
                    <Check className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
              </button>

              {/* Group */}
              <button type="button" onClick={() => setGoalType("group")}
                className={cn("w-full flex items-center gap-4 rounded-2xl border p-4 text-left transition-all",
                  goalType === "group" ? "border-ink bg-ink/5" : "border-cream-dark bg-cream hover:border-ink-muted/40")}>
                <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl",
                  goalType === "group" ? "bg-ink/10" : "bg-cream-dark")}>
                  👥
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink">Group goal</p>
                  <p className="text-sm text-ink-muted">Shared with your circle members</p>
                </div>
                {goalType === "group" && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold">
                    <Check className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
              </button>

              {goalType === "group" && (
                <div className="rounded-2xl border border-cream-dark bg-cream px-4 py-3">
                  <p className="text-xs text-ink-muted">You can invite circle members after creating the goal from the goal detail page.</p>
                </div>
              )}
            </div>

            <div className="flex justify-between gap-3">
              <button type="button" onClick={() => setStep(2)} className="btn-secondary min-h-[48px] rounded-2xl px-5">
                <ArrowLeft className="h-4 w-4" />Back
              </button>
              <button type="button" onClick={() => setStep(4)} className="btn-primary min-h-[48px] rounded-2xl px-6">
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {/* ── Step 4: Intentions / schedule ───────────────────────────── */}
        {step === 4 && (
          <>
            <div>
              <h2 className="text-2xl font-serif font-semibold text-ink">
                When will you work on &ldquo;{title}&rdquo;?
              </h2>
              <p className="mt-1 text-sm text-ink-muted">Add sessions — a reminder keeps you honest</p>
            </div>

            {/* Existing intentions */}
            <div className="space-y-2.5">
              {intentions.map((intention) => (
                <div key={intention.id} className="flex items-center gap-3 rounded-2xl border border-cream-dark bg-cream px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">{intention.label}</p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {intention.days.join(", ")} · {formatTime(intention.time)} · {intention.duration} min
                    </p>
                  </div>
                  <button type="button" onClick={() => removeIntention(intention.id)}
                    className="text-xs font-medium text-ink-muted hover:text-rose transition">Remove</button>
                </div>
              ))}
            </div>

            {/* Add intention form */}
            {addingIntention ? (
              <div className="rounded-2xl border border-cream-dark bg-cream p-4 space-y-3">
                <input type="text" value={newIntentionLabel} onChange={(e) => setNewIntentionLabel(e.target.value)}
                  placeholder="e.g. Morning run" className="form-input rounded-xl min-h-[44px]" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Time</label>
                    <input type="time" value={newIntentionTime} onChange={(e) => setNewIntentionTime(e.target.value)} className="form-input rounded-xl min-h-[44px]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Duration (min)</label>
                    <input type="number" value={newIntentionDuration} onChange={(e) => setNewIntentionDuration(Number(e.target.value))} min={5} max={480} step={5} className="form-input rounded-xl min-h-[44px]" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Days</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAYS_SHORT.map((d) => (
                      <button key={d} type="button" onClick={() => toggleDay(d)}
                        className={cn("rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition",
                          newIntentionDays.includes(d) ? "border-ink bg-ink text-cream-paper" : "border-cream-dark text-ink-muted hover:border-ink-muted/50")}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={addIntention} className="btn-primary flex-1 min-h-[40px] rounded-xl text-sm">
                    <Plus className="h-3.5 w-3.5" />Add session
                  </button>
                  <button type="button" onClick={() => setAddingIntention(false)} className="btn-secondary min-h-[40px] rounded-xl px-4 text-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setAddingIntention(true)}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-cream-dark py-3.5 text-sm font-medium text-ink-muted hover:border-ink-muted/40 hover:text-ink transition">
                <Plus className="h-4 w-4" />Add another intention
              </button>
            )}

            <div className="flex justify-between gap-3">
              <button type="button" onClick={() => setStep(3)} className="btn-secondary min-h-[48px] rounded-2xl px-5">
                <ArrowLeft className="h-4 w-4" />Back
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(5)} className="btn-secondary min-h-[48px] rounded-2xl px-5 text-sm">Skip for now</button>
                <button type="button" onClick={() => setStep(5)} className="btn-primary min-h-[48px] rounded-2xl px-6">
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Step 5: Review & Save ────────────────────────────────────── */}
        {step === 5 && (
          <>
            <div>
              <h2 className="text-2xl font-serif font-semibold text-ink">Review &amp; Save</h2>
              <p className="mt-1 text-sm text-ink-muted">Confirm your goal before saving</p>
            </div>

            {/* Summary card */}
            <div className="rounded-2xl border border-cream-dark divide-y divide-cream-dark overflow-hidden">
              {/* Goal */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <span className="text-2xl">{emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink truncate">{title}</p>
                  <p className="text-xs text-ink-muted mt-0.5">{categoryData?.label} · {goalType === "solo" ? "Solo goal" : "Group goal"}</p>
                </div>
                <button type="button" onClick={() => setStep(1)} className="text-xs font-semibold text-gold hover:underline shrink-0">Edit</button>
              </div>

              {/* Deadline */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cream text-base shrink-0">📅</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{deadline ? formatDate(deadline) : "No deadline set"}</p>
                  {deadline && <p className="text-xs text-ink-muted">{daysFromNow(deadline)} days from today</p>}
                </div>
                <button type="button" onClick={() => setStep(2)} className="text-xs font-semibold text-gold hover:underline shrink-0">Edit</button>
              </div>

              {/* Intentions */}
              <div className="flex items-start gap-3 px-4 py-3.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cream text-base shrink-0">⏰</div>
                <div className="flex-1 min-w-0">
                  {intentions.length > 0 ? (
                    intentions.map((i) => (
                      <p key={i.id} className="text-sm text-ink">{i.days.join(", ")} · {formatTime(i.time)} · {i.duration} min</p>
                    ))
                  ) : (
                    <p className="text-sm text-ink-muted">No schedule set</p>
                  )}
                </div>
                <button type="button" onClick={() => setStep(4)} className="text-xs font-semibold text-gold hover:underline shrink-0">Edit</button>
              </div>

              {/* Predicted */}
              <div className="flex items-center gap-3 px-4 py-3.5 bg-emerald-50/50">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-base shrink-0">✅</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">Predicted: <span className="text-emerald-600">On track</span></p>
                  <p className="text-xs text-ink-muted">High confidence — you&apos;re set up for success</p>
                </div>
              </div>
            </div>

            <button type="button" onClick={handleSubmit} disabled={submitting}
              className="btn-gold w-full min-h-[52px] justify-center rounded-2xl text-base font-semibold disabled:opacity-50">
              {submitting ? (
                <><Loader2 className="h-5 w-5 animate-spin" />Saving…</>
              ) : (
                <>🏠 Save Goal</>
              )}
            </button>

            <button type="button" onClick={() => setStep(4)} className="w-full text-center text-sm text-ink-muted hover:text-ink transition py-1">
              <ArrowLeft className="h-3.5 w-3.5 inline mr-1" />Back
            </button>
          </>
        )}
      </div>

      <DecomposeModal open={decomposeOpen} onClose={() => setDecomposeOpen(false)} onAccept={applyDecomposed} />
    </>
  );
}
