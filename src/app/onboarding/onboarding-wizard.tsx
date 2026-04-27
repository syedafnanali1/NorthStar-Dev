"use client";

// src/app/onboarding/onboarding-wizard.tsx
// 6-step full-screen onboarding wizard.

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, ArrowRight, ArrowLeft, Mail, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import { DecomposeModal, type DecomposedGoal } from "@/components/ai/decompose-modal";
import {
  computeCadenceTarget,
  ensureSmartGoalTasks,
  inferGoalSmartSuggestion,
  makeAutoTaskSuggestion,
  type MoneyCadence,
} from "@/lib/goal-intelligence";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "health" | "finance" | "writing" | "body" | "mindset" | "custom";

interface GoalTemplate {
  id: string;
  category: Category;
  emoji: string;
  title: string;
  description: string;
  defaultWhy: string | null;
  defaultTasks: string[];
  targetValue: number | null;
  unit: string | null;
}

interface WizardState {
  selectedCategories: Category[];
  // Step 2
  selectedTemplate: GoalTemplate | null;
  useCustomGoal: boolean;
  customTitle: string;
  goalCategory: Category | null;
  targetValue: string;
  unit: string;
  endDate: string;
  // Step 3
  why: string;
  // Step 4
  tasks: string[];
  // Step 5
  inviteEmail: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: {
  value: Category;
  label: string;
  emoji: string;
  hint: string;
  color: string;
}[] = [
  { value: "health", label: "Health & Fitness", emoji: "🏃", hint: "km · miles · hours · reps", color: "#6B8C7A" },
  { value: "finance", label: "Finance", emoji: "💰", hint: "$ saved · debt paid", color: "#5B7EA6" },
  { value: "writing", label: "Writing & Creative", emoji: "✍️", hint: "words · pages · chapters", color: "#C4963A" },
  { value: "body", label: "Body Composition", emoji: "⚖️", hint: "kg · lbs · body fat %", color: "#B5705B" },
  { value: "mindset", label: "Mindset & Learning", emoji: "🧠", hint: "hours · sessions · books", color: "#7B6FA0" },
  { value: "custom", label: "Custom", emoji: "⭐", hint: "Define your own unit", color: "#C4963A" },
];

const WHY_SUGGESTIONS = [
  "For my health and longevity",
  "To prove I can do this",
  "For my family",
  "To build real confidence",
];

// ─── Star field (decorative) ──────────────────────────────────────────────────

const STARS = Array.from({ length: 70 }, (_, i) => ({
  id: i,
  left: `${(i * 137.508) % 100}%`,
  top: `${(i * 97.3) % 100}%`,
  size: i % 5 === 0 ? "2px" : "1px",
  opacity: 0.15 + (i % 7) * 0.07,
  delay: `${(i % 30) * 0.1}s`,
}));

// ─── Components ───────────────────────────────────────────────────────────────

function StarField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {STARS.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-white animate-twinkle"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            opacity: star.opacity,
            animationDelay: star.delay,
          }}
        />
      ))}
    </div>
  );
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-500",
              i < step ? "bg-gold" : i === step - 1 ? "bg-gold/80" : "bg-white/15"
            )}
          />
        ))}
      </div>
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">
        {step} / {total}
      </span>
    </div>
  );
}

// ─── Constellation canvas for step 6 ─────────────────────────────────────────

function ConstellationCanvas({ goalTitle }: { goalTitle: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W;
    canvas.height = H;

    // A handful of background dim stars.
    const bg = Array.from({ length: 40 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() > 0.7 ? 1.5 : 0.8,
      a: 0.15 + Math.random() * 0.3,
    }));

    // The "new star" that appears in the centre.
    const cx = W / 2;
    const cy = H / 2;

    function draw(ts: number) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / 1200, 1); // 1.2 s animation
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic

      ctx!.clearRect(0, 0, W, H);

      // Background stars.
      bg.forEach((s) => {
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255,255,255,${s.a})`;
        ctx!.fill();
      });

      // Gold glow.
      const glowR = 60 * eased;
      const grd = ctx!.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      grd.addColorStop(0, `rgba(196,150,58,${0.5 * eased})`);
      grd.addColorStop(1, "rgba(196,150,58,0)");
      ctx!.beginPath();
      ctx!.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx!.fillStyle = grd;
      ctx!.fill();

      // Star shape (5-point polygon).
      const outerR = 22 * eased;
      const innerR = 9 * eased;
      const points = 5;
      ctx!.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const angle = (i * Math.PI) / points - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        i === 0 ? ctx!.moveTo(x, y) : ctx!.lineTo(x, y);
      }
      ctx!.closePath();
      ctx!.fillStyle = `rgba(196,150,58,${eased})`;
      ctx!.shadowColor = "#C4963A";
      ctx!.shadowBlur = 20 * eased;
      ctx!.fill();
      ctx!.shadowBlur = 0;

      if (progress < 1) {
        animRef.current = requestAnimationFrame(draw);
      }
    }

    animRef.current = requestAnimationFrame(draw);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <div className="relative flex flex-col items-center gap-6">
      <canvas
        ref={canvasRef}
        className="h-48 w-full max-w-xs rounded-2xl"
        style={{ background: "transparent" }}
      />
      {goalTitle ? (
        <p className="max-w-xs text-center text-lg font-serif italic text-white/80">
          &ldquo;{goalTitle}&rdquo;
        </p>
      ) : null}
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

interface OnboardingWizardProps {
  userName?: string;
}

export function OnboardingWizard({ userName }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [decomposeOpen, setDecomposeOpen] = useState(false);
  const [templates, setTemplates] = useState<GoalTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [smartAmount, setSmartAmount] = useState("");
  const [moneyCadence, setMoneyCadence] = useState<MoneyCadence>("daily");

  const [state, setState] = useState<WizardState>({
    selectedCategories: [],
    selectedTemplate: null,
    useCustomGoal: false,
    customTitle: "",
    goalCategory: null,
    targetValue: "",
    unit: "",
    endDate: "",
    why: "",
    tasks: [],
    inviteEmail: "",
  });

  const update = useCallback(
    <K extends keyof WizardState>(key: K, value: WizardState[K]) =>
      setState((prev) => ({ ...prev, [key]: value })),
    []
  );

  const goalTitle = state.selectedTemplate?.title ?? state.customTitle ?? "";

  const smartSuggestion = useMemo(
    () =>
      inferGoalSmartSuggestion(
        goalTitle,
        state.why,
        state.goalCategory ?? state.selectedTemplate?.category ?? null
      ),
    [goalTitle, state.goalCategory, state.selectedTemplate?.category, state.why]
  );

  const smartAmountNumber = useMemo(() => {
    const parsed = Number(smartAmount);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [smartAmount]);

  useEffect(() => {
    if (!state.goalCategory && goalTitle.trim().length >= 3) {
      update("goalCategory", smartSuggestion.category);
    }
    if (!state.unit && smartSuggestion.unit) {
      update("unit", smartSuggestion.unit);
    }
  }, [
    goalTitle,
    smartSuggestion.category,
    smartSuggestion.unit,
    state.goalCategory,
    state.unit,
    update,
  ]);

  // Fetch templates whenever categories change and we move to step 2.
  const fetchTemplates = useCallback(async (categories: Category[]) => {
    setLoadingTemplates(true);
    try {
      const params = categories.length
        ? `?categories=${categories.join(",")}`
        : "";
      const res = await fetch(`/api/goal-templates${params}`);
      if (!res.ok) throw new Error("Failed to load templates");
      const data = (await res.json()) as { templates: GoalTemplate[] };
      setTemplates(data.templates ?? []);
    } catch {
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  // ── Step navigation ──────────────────────────────────────────────────────

  function goNext() {
    if (step === 1) {
      if (state.selectedCategories.length === 0) {
        toast("Select at least one category to continue", "error");
        return;
      }
      fetchTemplates(state.selectedCategories);
    }
    setStep((s) => s + 1);
  }

  function goBack() {
    setStep((s) => s - 1);
  }

  // ── Template selection ────────────────────────────────────────────────────

  function selectTemplate(tpl: GoalTemplate) {
    update("selectedTemplate", tpl);
    update("useCustomGoal", false);
    update("customTitle", tpl.title);
    update("goalCategory", tpl.category);
    update("targetValue", tpl.targetValue !== null ? String(tpl.targetValue) : "");
    update("unit", tpl.unit ?? "");
    update("endDate", "");
    update("why", tpl.defaultWhy ?? "");
    update("tasks", tpl.defaultTasks ?? []);
    setSmartAmount(tpl.targetValue !== null ? String(tpl.targetValue) : "");
    setMoneyCadence("daily");
  }

  function selectCustomGoal() {
    update("selectedTemplate", null);
    update("useCustomGoal", true);
    update("customTitle", "");
    update("goalCategory", state.selectedCategories[0] ?? "custom");
    update("targetValue", "");
    update("unit", "");
    update("endDate", "");
    update("why", "");
    update("tasks", []);
    setSmartAmount("");
    setMoneyCadence("daily");
  }

  function applyDecomposedGoal(goal: DecomposedGoal) {
    update("selectedTemplate", null);
    update("useCustomGoal", true);
    update("customTitle", goal.title);
    update("goalCategory", goal.category);
    update(
      "selectedCategories",
      state.selectedCategories.includes(goal.category)
        ? state.selectedCategories
        : [goal.category, ...state.selectedCategories].slice(0, 3)
    );
    update("targetValue", goal.targetValue !== null ? String(goal.targetValue) : "");
    update("unit", goal.unit ?? "");
    update("endDate", goal.suggestedEndDate ?? "");
    update("why", goal.why ?? "");
    update("tasks", goal.suggestedTasks.slice(0, 10));
    setSmartAmount(goal.targetValue !== null ? String(goal.targetValue) : "");
    setMoneyCadence("daily");
    toast("Goal pre-filled by AI ✨");
  }

  // ── Step 2 validation ──────────────────────────────────────────────────────

  function validateStep2() {
    if (state.useCustomGoal) {
      if (!state.customTitle.trim() || state.customTitle.trim().length < 3) {
        toast("Enter a goal title (at least 3 characters)", "error");
        return false;
      }
    } else if (!state.selectedTemplate) {
      toast("Select a template, use AI, or create your own goal", "error");
      return false;
    }
    return true;
  }

  // ── Task helpers ──────────────────────────────────────────────────────────

  function addTask() {
    const trimmed = newTask.trim();
    if (!trimmed || state.tasks.length >= 10) return;
    update("tasks", [...state.tasks, trimmed]);
    setNewTask("");
  }

  function removeTask(index: number) {
    update("tasks", state.tasks.filter((_, i) => i !== index));
  }

  function addSmartTask() {
    const suggestedTask = makeAutoTaskSuggestion({
      title: goalTitle || "this goal",
      intent: smartSuggestion.intent,
      amount: smartAmountNumber,
      unit: state.unit || smartSuggestion.unit,
      cadence: moneyCadence,
      startDate: null,
      endDate: state.endDate || null,
      targetValue: state.targetValue ? Number(state.targetValue) : null,
    });

    if (!suggestedTask.text || state.tasks.length >= 10) return;
    if (state.tasks.some((task) => task.toLowerCase() === suggestedTask.text.toLowerCase())) {
      return;
    }

    update("tasks", [...state.tasks, suggestedTask.text]);
  }

  // ── Final submit ──────────────────────────────────────────────────────────

  async function handleFinish() {
    setSubmitting(true);
    try {
      const title = (state.selectedTemplate?.title ?? state.customTitle).trim();
      if (!title || title.length < 3) {
        throw new Error("Please enter a goal title with at least 3 characters.");
      }
      const category: Category =
        state.goalCategory ??
        state.selectedTemplate?.category ??
        smartSuggestion.category ??
        (state.selectedCategories[0] ?? "custom");
      const parsedTargetValue = state.targetValue.trim()
        ? Number(state.targetValue)
        : undefined;
      if (
        parsedTargetValue !== undefined &&
        (!Number.isFinite(parsedTargetValue) || parsedTargetValue <= 0)
      ) {
        throw new Error("Target amount must be a positive number.");
      }

      const computedMoneyTarget =
        smartSuggestion.intent === "money_saving" && smartAmountNumber
          ? computeCadenceTarget({
              amount: smartAmountNumber,
              cadence: moneyCadence,
              endDate: state.endDate.trim() || null,
            })
          : null;
      const resolvedTargetValue =
        parsedTargetValue ??
        (smartSuggestion.intent === "weight_loss" ? smartAmountNumber ?? undefined : undefined) ??
        (computedMoneyTarget ?? undefined);
      const resolvedUnit = state.unit.trim() || smartSuggestion.unit || undefined;
      const preparedTasks = ensureSmartGoalTasks({
        title,
        intent: smartSuggestion.intent,
        unit: resolvedUnit ?? null,
        amount: smartAmountNumber ?? resolvedTargetValue ?? null,
        cadence: moneyCadence,
        startDate: null,
        endDate: state.endDate.trim() || null,
        targetValue: resolvedTargetValue ?? null,
        tasks: state.tasks.map((text) => ({ text })),
      });

      const goalPayload = {
        title,
        why: state.why || undefined,
        category,
        color:
          CATEGORIES.find((c) => c.value === category)?.color ?? "#C4963A",
        emoji: state.selectedTemplate?.emoji ?? "⭐",
        targetValue: resolvedTargetValue,
        unit: resolvedUnit,
        endDate: state.endDate.trim() || undefined,
        tasks: preparedTasks.map((task) => ({
          text: task.text,
          isRepeating: true,
          incrementValue: task.incrementValue,
        })),
        milestones: [],
        isPublic: false,
      };

      // 1. Create the goal.
      const goalRes = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(goalPayload),
      });

      if (!goalRes.ok) {
        const err = (await goalRes.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to create goal");
      }

      // 2. Mark onboarding complete.
      const completeRes = await fetch("/api/onboarding/complete", {
        method: "POST",
      });
      if (!completeRes.ok) {
        // Non-fatal — goal was created; still proceed.
        console.error("Failed to mark onboarding complete");
      }

      // 3. Optionally send invite (fire-and-forget, non-fatal).
      if (state.inviteEmail.trim()) {
        fetch("/api/invitations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: state.inviteEmail.trim(), goalIds: [] }),
        }).catch(() => null);
      }

      // 4. Navigate to dashboard.
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Something went wrong",
        "error"
      );
      setSubmitting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0E0C0A]">
      <StarField />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-start px-4 py-8 sm:justify-center sm:py-12">
        <div className="mobile-sheet w-full bg-[#171411]/96 px-5 py-6 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:max-w-xl sm:rounded-3xl sm:border sm:border-white/10 sm:px-8 sm:py-8 lg:max-w-2xl">

          {/* Logo + progress */}
          <div className="mb-8 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/6">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L14.4 9.6H22L15.8 14.4L18.2 22L12 17.2L5.8 22L8.2 14.4L2 9.6H9.6L12 2Z"
                    fill="#C4963A"
                  />
                </svg>
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/35">
                NorthStar
              </span>
            </div>
            <ProgressBar step={step} total={6} />
          </div>

          {/* ── Step 1: Categories ─────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-serif text-white sm:text-4xl">
                  {userName ? `Welcome, ${userName.split(" ")[0]}.` : "Welcome."}
                </h1>
                <p className="mt-3 text-lg font-serif italic text-white/60">
                  What do you want to achieve?
                </p>
                <p className="mt-1 text-sm text-white/40">
                  Select all that apply.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {CATEGORIES.map((cat) => {
                  const selected = state.selectedCategories.includes(cat.value);
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => {
                        const next = selected
                          ? state.selectedCategories.filter((c) => c !== cat.value)
                          : [...state.selectedCategories, cat.value];
                        update("selectedCategories", next);
                      }}
                      className={cn(
                        "min-h-[100px] rounded-2xl border p-4 text-left transition-all duration-200",
                        selected
                          ? "border-gold/60 bg-gold/10 text-white"
                          : "border-white/10 bg-white/4 text-white/70 hover:border-white/25 hover:bg-white/8"
                      )}
                    >
                      <span className="text-2xl">{cat.emoji}</span>
                      <span className="mt-2 block text-sm font-semibold leading-snug">
                        {cat.label}
                      </span>
                      <span
                        className={cn(
                          "mt-1 block text-[11px] leading-4",
                          selected ? "text-white/50" : "text-white/30"
                        )}
                      >
                        {cat.hint}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={goNext}
                  className="btn-gold min-h-[48px] rounded-2xl px-6 text-sm disabled:opacity-40"
                  disabled={state.selectedCategories.length === 0}
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Template ───────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-serif text-white">Your First Goal</h2>
                  <p className="mt-2 text-sm text-white/45">
                    Pick a template, create manually, or let AI structure it for you.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDecomposeOpen(true)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Assist
                </button>
              </div>

              {loadingTemplates ? (
                <div className="flex items-center gap-3 py-8 text-white/40">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading suggestions…</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map((tpl) => {
                    const selected =
                      !state.useCustomGoal &&
                      state.selectedTemplate?.id === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => selectTemplate(tpl)}
                        className={cn(
                          "w-full rounded-2xl border p-4 text-left transition-all duration-200",
                          selected
                            ? "border-gold/60 bg-gold/10"
                            : "border-white/10 bg-white/4 hover:border-white/25 hover:bg-white/8"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{tpl.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-white">{tpl.title}</p>
                            <p className="mt-1 text-sm leading-5 text-white/50">
                              {tpl.description}
                            </p>
                          </div>
                          {selected && (
                            <div className="mt-1 h-4 w-4 shrink-0 rounded-full bg-gold" />
                          )}
                        </div>
                      </button>
                    );
                  })}

                  {/* Custom option */}
                  <button
                    type="button"
                    onClick={selectCustomGoal}
                    className={cn(
                      "w-full rounded-2xl border p-4 text-left transition-all duration-200",
                      state.useCustomGoal
                        ? "border-gold/60 bg-gold/10"
                        : "border-white/10 bg-white/4 hover:border-white/25 hover:bg-white/8"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">✏️</span>
                      <p className="font-semibold text-white/70">
                        + Create your own
                      </p>
                    </div>
                  </button>
                </div>
              )}

              {/* Custom title input */}
              {state.useCustomGoal && (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
                    Goal Title
                  </label>
                  <input
                    type="text"
                    value={state.customTitle}
                    onChange={(e) => update("customTitle", e.target.value)}
                    placeholder="e.g. Run a half marathon"
                    className="w-full rounded-2xl border border-white/15 bg-white/6 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
                    maxLength={120}
                  />
                </div>
              )}

              <div className="rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-white/70">
                <p className="font-semibold text-gold">
                  Smart detection:{" "}
                  {smartSuggestion.intent === "reading"
                    ? "Reading goal"
                    : smartSuggestion.intent === "weight_loss"
                    ? "Weight goal"
                    : smartSuggestion.intent === "money_saving"
                    ? "Money goal"
                    : "Custom goal"}
                </p>
                <p className="mt-1 text-white/55">
                  {smartSuggestion.intent === "reading"
                    ? "We will track pages and auto-log your selected page amount for each completed intention."
                    : smartSuggestion.intent === "weight_loss"
                    ? "Set your target loss and unit. Progress can be distributed automatically to keep you on pace."
                    : smartSuggestion.intent === "money_saving"
                    ? "Set amount + cadence. If you choose a deadline, we will calculate the total target for you."
                    : "Use any metric and unit you want. You can still edit later."}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
                    {smartSuggestion.intent === "reading"
                      ? smartSuggestion.quantityLabel
                      : smartSuggestion.intent === "weight_loss"
                      ? smartSuggestion.quantityLabel
                      : smartSuggestion.intent === "money_saving"
                      ? smartSuggestion.quantityLabel
                      : "Target (optional)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={smartSuggestion.intent === "generic" ? state.targetValue : smartAmount}
                    onChange={(e) => {
                      if (smartSuggestion.intent === "generic") {
                        update("targetValue", e.target.value);
                        return;
                      }
                      setSmartAmount(e.target.value);
                      if (smartSuggestion.intent === "weight_loss") {
                        update("targetValue", e.target.value);
                      }
                    }}
                    placeholder="42.2"
                    className="w-full rounded-2xl border border-white/15 bg-white/6 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
                    Unit
                  </label>
                  {smartSuggestion.intent === "reading" ? (
                    <input
                      type="text"
                      value="pages"
                      readOnly
                      className="w-full rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-white/70 outline-none"
                    />
                  ) : smartSuggestion.intent === "money_saving" || smartSuggestion.intent === "weight_loss" ? (
                    <select
                      value={state.unit || smartSuggestion.unit || ""}
                      onChange={(e) => update("unit", e.target.value)}
                      className="w-full rounded-2xl border border-white/15 bg-white/6 px-4 py-3 text-sm text-white outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
                    >
                      {smartSuggestion.unitOptions.map((unitOption) => (
                        <option key={unitOption} value={unitOption}>
                          {unitOption}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={state.unit}
                      onChange={(e) => update("unit", e.target.value)}
                      placeholder="km"
                      maxLength={20}
                      className="w-full rounded-2xl border border-white/15 bg-white/6 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={state.endDate}
                    onChange={(e) => update("endDate", e.target.value)}
                    className="w-full rounded-2xl border border-white/15 bg-white/6 px-4 py-3 text-sm text-white outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
                  />
                </div>
              </div>

              {smartSuggestion.intent === "money_saving" ? (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
                    Cadence
                  </label>
                  <select
                    value={moneyCadence}
                    onChange={(e) => setMoneyCadence(e.target.value as MoneyCadence)}
                    className="w-full rounded-2xl border border-white/15 bg-white/6 px-4 py-3 text-sm text-white outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
                  >
                    {smartSuggestion.cadenceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="flex justify-between gap-3">
                <button
                  type="button"
                  onClick={goBack}
                  className="btn-ghost min-h-[48px] rounded-2xl px-5 text-sm text-white/60 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (validateStep2()) goNext();
                  }}
                  className="btn-gold min-h-[48px] rounded-2xl px-6 text-sm"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Why ────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-serif text-white leading-tight">
                  What&apos;s driving this?
                </h2>
                <p className="mt-3 text-base font-serif italic text-white/55">
                  Why does{" "}
                  <span className="text-gold/90">&ldquo;{goalTitle}&rdquo;</span>{" "}
                  matter to you?
                </p>
              </div>

              <textarea
                value={state.why}
                onChange={(e) => update("why", e.target.value)}
                placeholder="Write anything that comes to mind…"
                maxLength={500}
                rows={5}
                className="w-full resize-none rounded-2xl border border-white/15 bg-white/6 px-4 py-3 font-serif text-base italic leading-7 text-white placeholder-white/25 outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
              />

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/30">
                  Need a prompt?
                </p>
                <div className="flex flex-wrap gap-2">
                  {WHY_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() =>
                        update(
                          "why",
                          state.why
                            ? `${state.why} ${suggestion.toLowerCase()}`
                            : suggestion
                        )
                      }
                      className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-xs text-white/50 transition hover:border-white/25 hover:text-white/80"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between gap-3">
                <button
                  type="button"
                  onClick={goBack}
                  className="btn-ghost min-h-[48px] rounded-2xl px-5 text-sm text-white/60 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="btn-gold min-h-[48px] rounded-2xl px-6 text-sm"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Daily habits ───────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-serif text-white">Build Your Daily Habit</h2>
                <p className="mt-2 text-sm text-white/45">
                  These appear on your calendar every day as intentions.
                </p>
              </div>

              {state.tasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-3 text-sm text-white/65">
                  <p className="font-semibold text-white/85">Quick start intention</p>
                  <p className="mt-1">
                    Auto-suggest:{" "}
                    <span className="text-white">
                      {
                        makeAutoTaskSuggestion({
                          title: goalTitle || "this goal",
                          intent: smartSuggestion.intent,
                          amount: smartAmountNumber,
                          unit: state.unit || smartSuggestion.unit,
                          cadence: moneyCadence,
                          endDate: state.endDate || null,
                          targetValue: state.targetValue ? Number(state.targetValue) : null,
                        }).text
                      }
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={addSmartTask}
                    className="mt-2 inline-flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Use smart default
                  </button>
                </div>
              ) : null}

              <div className="space-y-2">
                {state.tasks.map((task, index) => (
                  <div
                    key={`${task}-${index}`}
                    className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-gold/70" />
                    <span className="flex-1 text-sm text-white/85">{task}</span>
                    <button
                      type="button"
                      onClick={() => removeTask(index)}
                      className="shrink-0 text-white/30 transition hover:text-rose-400"
                      aria-label="Remove task"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTask();
                    }
                  }}
                  placeholder="Add a daily action…"
                  maxLength={200}
                  className="flex-1 rounded-2xl border border-white/15 bg-white/6 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
                />
                <button
                  type="button"
                  onClick={addTask}
                  disabled={!newTask.trim() || state.tasks.length >= 10}
                  className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/8 px-4 py-3 text-sm text-white/70 transition hover:bg-white/14 disabled:opacity-30"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>

              <div className="flex justify-between gap-3">
                <button
                  type="button"
                  onClick={goBack}
                  className="btn-ghost min-h-[48px] rounded-2xl px-5 text-sm text-white/60 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="btn-gold min-h-[48px] rounded-2xl px-6 text-sm"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 5: Invite ─────────────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-serif text-white">Invite Your Circle</h2>
                <p className="mt-3 text-sm leading-6 text-white/45">
                  Goal tracking is{" "}
                  <span className="font-semibold text-gold/80">2×</span> more
                  effective with accountability. Invite a friend to join you.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
                  Friend&apos;s Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    type="email"
                    value={state.inviteEmail}
                    onChange={(e) => update("inviteEmail", e.target.value)}
                    placeholder="friend@example.com"
                    className="w-full rounded-2xl border border-white/15 bg-white/6 py-3 pl-11 pr-4 text-sm text-white placeholder-white/25 outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={goBack}
                  className="btn-ghost min-h-[48px] rounded-2xl px-5 text-sm text-white/60 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={goNext}
                    className="min-h-[48px] rounded-2xl border border-white/15 bg-transparent px-5 text-sm text-white/55 transition hover:border-white/30 hover:text-white/80"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    className="btn-gold min-h-[48px] rounded-2xl px-6 text-sm"
                  >
                    Send Invite
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 6: Celebration ────────────────────────────────────── */}
          {step === 6 && (
            <div className="space-y-8 text-center">
              <div className="space-y-3">
                <h2 className="text-4xl font-serif text-white sm:text-5xl">
                  Your Star is Planted ⭐
                </h2>
                <p className="text-base text-white/50">
                  Your journey starts now. Every day you show up, your
                  constellation grows.
                </p>
              </div>

              <ConstellationCanvas goalTitle={goalTitle} />

              <button
                type="button"
                onClick={handleFinish}
                disabled={submitting}
                className="btn-gold mx-auto min-h-[52px] min-w-[200px] justify-center rounded-2xl px-8 text-base disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Planting your star…
                  </>
                ) : (
                  <>
                    Let&apos;s go
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
      <DecomposeModal
        open={decomposeOpen}
        onClose={() => setDecomposeOpen(false)}
        onAccept={applyDecomposedGoal}
      />
    </div>
  );
}
