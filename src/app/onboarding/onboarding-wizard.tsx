"use client";

// src/app/onboarding/onboarding-wizard.tsx

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Sparkles, Lock, X, Plus, Mail, ArrowLeft } from "lucide-react";
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
  selectedTemplate: GoalTemplate | null;
  useCustomGoal: boolean;
  customTitle: string;
  goalCategory: Category | null;
  targetValue: string;
  unit: string;
  endDate: string;
  why: string;
  tasks: string[];
  inviteEmail: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: Category; label: string; emoji: string; hint: string; color: string }[] = [
  { value: "health",  label: "Health & Fitness",   emoji: "🏃", hint: "km · miles · hours · reps",      color: "#6B8C7A" },
  { value: "finance", label: "Finance",             emoji: "💰", hint: "$ saved · debt paid",            color: "#5B7EA6" },
  { value: "writing", label: "Writing & Creative",  emoji: "✍️", hint: "words · pages · chapters",       color: "#C4963A" },
  { value: "body",    label: "Body Composition",    emoji: "⚖️", hint: "kg · lbs · body fat %",          color: "#B5705B" },
  { value: "mindset", label: "Mindset & Learning",  emoji: "🧠", hint: "hours · sessions · books",       color: "#7B6FA0" },
  { value: "custom",  label: "Custom",              emoji: "⭐", hint: "Define your own unit",           color: "#C4963A" },
];

const WHY_SUGGESTIONS = [
  "For my health and longevity",
  "To prove I can do this",
  "For my family",
  "To build real confidence",
];

// ─── Star field ───────────────────────────────────────────────────────────────

const STARS = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  left: `${(i * 137.508) % 100}%`,
  top: `${(i * 97.3) % 100}%`,
  size: i % 5 === 0 ? "2px" : "1px",
  opacity: 0.1 + (i % 7) * 0.05,
  delay: `${(i % 30) * 0.1}s`,
}));

function StarField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {STARS.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-white animate-twinkle"
          style={{ left: star.left, top: star.top, width: star.size, height: star.size, opacity: star.opacity, animationDelay: star.delay }}
        />
      ))}
    </div>
  );
}

// ─── Carousel ─────────────────────────────────────────────────────────────────

function CarouselPhase({ onComplete }: { onComplete: () => void }) {
  const [slide, setSlide] = useState(0);
  const total = 4;

  const slides = [
    // 1 — Welcome
    {
      content: (
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gold/15 shadow-[0_0_60px_rgba(196,150,58,0.3)]">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L14.4 9.6H22L15.8 14.4L18.2 22L12 17.2L5.8 22L8.2 14.4L2 9.6H9.6L12 2Z" fill="#C4963A" />
            </svg>
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-serif font-semibold text-white">Your NorthStar</h1>
            <p className="text-base text-white/55 leading-relaxed">
              Set goals. Stay accountable.<br />Achieve with your circle.
            </p>
          </div>
        </div>
      ),
      cta: "Get started",
      showSkip: true,
    },
    // 2 — Goals preview
    {
      content: (
        <div className="flex flex-col items-center gap-5 text-center w-full">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/15">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C4963A" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          </div>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-serif font-semibold text-white">Set goals that stick</h2>
            <p className="text-sm text-white/50">Solo goals. Group goals. AI-powered goals.</p>
          </div>
          {/* Mini goal cards */}
          <div className="w-full max-w-[280px] space-y-2.5 text-left">
            <div className="rounded-xl border border-white/10 bg-white/7 px-3.5 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">🏃</span>
                  <span className="text-sm font-semibold text-white">Run a 5K</span>
                </div>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">On track ✓</span>
              </div>
              <p className="text-[10px] text-white/35 mb-1.5">Body · 30 days</p>
              <div className="h-1 w-full rounded-full bg-white/10">
                <div className="h-1 rounded-full bg-emerald-400/70" style={{ width: "62%" }} />
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/7 px-3.5 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">📚</span>
                  <span className="text-sm font-semibold text-white">Read 12 books this year</span>
                </div>
              </div>
              <p className="text-[10px] text-white/35 mb-1.5">Mind · 303 days · 3/12 done</p>
              <div className="h-1 w-full rounded-full bg-white/10">
                <div className="h-1 rounded-full bg-gold/60" style={{ width: "25%" }} />
              </div>
            </div>
          </div>
        </div>
      ),
      cta: "Next →",
      showSkip: true,
    },
    // 3 — Circle preview
    {
      content: (
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.8">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-serif font-semibold text-white">Your Circle</h2>
            <p className="text-sm text-white/50">Invite friends. Share goals.<br />Hold each other accountable.</p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="flex -space-x-3">
              {[
                { letter: "A", color: "#C4963A" },
                { letter: "J", color: "#5B7EA6" },
                { letter: "M", color: "#6B8C7A" },
                { letter: "K", color: "#7B6FA0" },
              ].map(({ letter, color }) => (
                <div
                  key={letter}
                  className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#0E0C0A] text-sm font-bold text-white"
                  style={{ background: color }}
                >
                  {letter}
                </div>
              ))}
              <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#0E0C0A] bg-white/10 text-xs font-semibold text-white/60">
                +12
              </div>
            </div>
            <p className="text-xs text-white/35 font-medium">Your accountability circle</p>
          </div>
        </div>
      ),
      cta: "Next →",
      showSkip: true,
    },
    // 4 — Stats preview
    {
      content: (
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/15">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="14" width="4" height="8" rx="1" fill="#60A5FA" opacity="0.7" />
              <rect x="8" y="10" width="4" height="12" rx="1" fill="#34D399" opacity="0.8" />
              <rect x="14" y="6" width="4" height="16" rx="1" fill="#C4963A" opacity="0.9" />
              <rect x="20" y="3" width="4" height="19" rx="1" fill="#A78BFA" />
            </svg>
          </div>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-serif font-semibold text-white">Track your progress</h2>
            <p className="text-sm text-white/50">Daily check-ins. Smart coaching.<br />See your data. Improve.</p>
          </div>
          <div className="w-full max-w-[240px] rounded-2xl border border-white/10 bg-white/7 px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-1">Momentum</p>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-3xl font-bold text-gold">82</span>
              <span className="text-sm text-white/35">/100</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/10 mb-2">
              <div className="h-2 rounded-full bg-gold" style={{ width: "82%" }} />
            </div>
            <p className="text-[11px] text-emerald-400 font-medium">On track — keep your streak alive 🔥</p>
          </div>
        </div>
      ),
      cta: "Let's go! 🎉",
      showSkip: false,
    },
  ];

  const current = slides[slide]!;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0E0C0A]">
      <StarField />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-between px-6 py-12">
        {/* Top dots + skip */}
        <div className="flex w-full max-w-sm items-center justify-between">
          <div className="flex gap-2">
            {Array.from({ length: total }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-400",
                  i === slide ? "w-6 bg-gold" : i < slide ? "w-4 bg-gold/40" : "w-4 bg-white/15"
                )}
              />
            ))}
          </div>
          {current.showSkip && (
            <button type="button" onClick={onComplete} className="text-sm text-white/35 hover:text-white/60 transition-colors">
              Skip
            </button>
          )}
        </div>

        {/* Slide content */}
        <div className="flex w-full max-w-sm flex-col items-center">
          {current.content}
        </div>

        {/* CTA */}
        <div className="w-full max-w-sm space-y-3">
          <button
            type="button"
            onClick={() => {
              if (slide < total - 1) setSlide((s) => s + 1);
              else onComplete();
            }}
            className="btn-gold w-full min-h-[52px] justify-center rounded-2xl text-base font-semibold"
          >
            {current.cta}
          </button>
          {slide === 0 && (
            <button type="button" onClick={onComplete} className="w-full text-center text-sm text-white/35 hover:text-white/55 transition-colors py-1">
              Skip intro →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={cn("h-1 flex-1 rounded-full transition-all duration-500", i < step ? "bg-gold" : "bg-white/15")}
          />
        ))}
      </div>
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">
        {step} / {total}
      </span>
    </div>
  );
}

// ─── Constellation (celebration) ──────────────────────────────────────────────

function ConstellationCanvas({ goalTitle }: { goalTitle: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    canvas.width = W; canvas.height = H;
    const bg = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() > 0.7 ? 1.5 : 0.8, a: 0.15 + Math.random() * 0.3 }));
    const cx = W / 2, cy = H / 2;

    function draw(ts: number) {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / 1200, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      ctx!.clearRect(0, 0, W, H);
      bg.forEach((s) => { ctx!.beginPath(); ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx!.fillStyle = `rgba(255,255,255,${s.a})`; ctx!.fill(); });
      const glowR = 60 * eased;
      const grd = ctx!.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      grd.addColorStop(0, `rgba(196,150,58,${0.5 * eased})`); grd.addColorStop(1, "rgba(196,150,58,0)");
      ctx!.beginPath(); ctx!.arc(cx, cy, glowR, 0, Math.PI * 2); ctx!.fillStyle = grd; ctx!.fill();
      const outerR = 22 * eased, innerR = 9 * eased;
      ctx!.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        i === 0 ? ctx!.moveTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle)) : ctx!.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
      }
      ctx!.closePath(); ctx!.fillStyle = `rgba(196,150,58,${eased})`; ctx!.shadowColor = "#C4963A"; ctx!.shadowBlur = 20 * eased; ctx!.fill(); ctx!.shadowBlur = 0;
      if (progress < 1) animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  return (
    <div className="flex flex-col items-center gap-6">
      <canvas ref={canvasRef} className="h-48 w-full max-w-xs rounded-2xl" style={{ background: "transparent" }} />
      {goalTitle ? <p className="max-w-xs text-center text-lg font-serif italic text-white/80">&ldquo;{goalTitle}&rdquo;</p> : null}
    </div>
  );
}

// ─── Premium lock banner ──────────────────────────────────────────────────────

function PremiumLockBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="rounded-2xl border border-gold/30 bg-gold/10 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gold/20">
          <Lock className="h-4 w-4 text-gold" />
        </div>
        <div>
          <p className="font-semibold text-gold text-sm">AI Goal Creation is Premium</p>
          <p className="mt-1 text-xs text-white/55 leading-5">
            Upgrade to Pro to let Claude structure your goal — milestones, daily habits, and a measurable target.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <a href="/premium" target="_blank" rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gold px-3 py-2 text-xs font-semibold text-ink hover:opacity-90 transition">
          <Sparkles className="h-3.5 w-3.5" />Unlock Premium
        </a>
        <button type="button" onClick={onDismiss}
          className="rounded-xl border border-white/15 px-3 py-2 text-xs text-white/50 hover:text-white/80 transition">
          Not now
        </button>
      </div>
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

interface OnboardingWizardProps {
  userName?: string;
  hasPremiumAI?: boolean;
}

export function OnboardingWizard({ userName, hasPremiumAI = false }: OnboardingWizardProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<"carousel" | "wizard">("carousel");
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [decomposeOpen, setDecomposeOpen] = useState(false);
  const [showAILock, setShowAILock] = useState(false);
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
    () => inferGoalSmartSuggestion(goalTitle, state.why, state.goalCategory ?? state.selectedTemplate?.category ?? null),
    [goalTitle, state.goalCategory, state.selectedTemplate?.category, state.why]
  );

  const smartAmountNumber = useMemo(() => {
    const parsed = Number(smartAmount);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [smartAmount]);

  useEffect(() => {
    if (!state.goalCategory && goalTitle.trim().length >= 3) update("goalCategory", smartSuggestion.category);
    if (!state.unit && smartSuggestion.unit) update("unit", smartSuggestion.unit);
  }, [goalTitle, smartSuggestion.category, smartSuggestion.unit, state.goalCategory, state.unit, update]);

  const fetchTemplates = useCallback(async (categories: Category[]) => {
    setLoadingTemplates(true);
    try {
      const params = categories.length ? `?categories=${categories.join(",")}` : "";
      const res = await fetch(`/api/goal-templates${params}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { templates: GoalTemplate[] };
      setTemplates(data.templates ?? []);
    } catch { setTemplates([]); }
    finally { setLoadingTemplates(false); }
  }, []);

  function goNext() {
    if (step === 1) {
      if (state.selectedCategories.length === 0) { toast("Select at least one category", "error"); return; }
      fetchTemplates(state.selectedCategories);
    }
    if (step === 2 && !validateStep2()) return;
    setStep((s) => s + 1);
  }

  function goBack() {
    if (step === 1) setPhase("carousel");
    else setStep((s) => s - 1);
  }

  function handleAIClick() {
    if (hasPremiumAI) setDecomposeOpen(true);
    else setShowAILock(true);
  }

  function selectTemplate(tpl: GoalTemplate) {
    update("selectedTemplate", tpl); update("useCustomGoal", false); update("customTitle", tpl.title);
    update("goalCategory", tpl.category); update("targetValue", tpl.targetValue !== null ? String(tpl.targetValue) : "");
    update("unit", tpl.unit ?? ""); update("endDate", ""); update("why", tpl.defaultWhy ?? ""); update("tasks", tpl.defaultTasks ?? []);
    setSmartAmount(tpl.targetValue !== null ? String(tpl.targetValue) : ""); setMoneyCadence("daily"); setShowAILock(false);
  }

  function selectCustomGoal() {
    update("selectedTemplate", null); update("useCustomGoal", true); update("customTitle", "");
    update("goalCategory", state.selectedCategories[0] ?? "custom"); update("targetValue", ""); update("unit", "");
    update("endDate", ""); update("why", ""); update("tasks", []); setSmartAmount(""); setMoneyCadence("daily"); setShowAILock(false);
  }

  function applyDecomposedGoal(goal: DecomposedGoal) {
    update("selectedTemplate", null); update("useCustomGoal", true); update("customTitle", goal.title);
    update("goalCategory", goal.category);
    update("selectedCategories", state.selectedCategories.includes(goal.category) ? state.selectedCategories : [goal.category, ...state.selectedCategories].slice(0, 3));
    update("targetValue", goal.targetValue !== null ? String(goal.targetValue) : ""); update("unit", goal.unit ?? "");
    update("endDate", goal.suggestedEndDate ?? ""); update("why", goal.why ?? ""); update("tasks", goal.suggestedTasks.slice(0, 10));
    setSmartAmount(goal.targetValue !== null ? String(goal.targetValue) : ""); setMoneyCadence("daily"); toast("Goal pre-filled by AI ✨");
  }

  function validateStep2() {
    if (state.useCustomGoal) {
      if (!state.customTitle.trim() || state.customTitle.trim().length < 3) { toast("Enter a goal title (at least 3 characters)", "error"); return false; }
    } else if (!state.selectedTemplate) { toast("Select a template, use AI, or create your own goal", "error"); return false; }
    return true;
  }

  function addTask() {
    const trimmed = newTask.trim();
    if (!trimmed || state.tasks.length >= 10) return;
    update("tasks", [...state.tasks, trimmed]); setNewTask("");
  }

  function removeTask(index: number) { update("tasks", state.tasks.filter((_, i) => i !== index)); }

  function addSmartTask() {
    const s = makeAutoTaskSuggestion({ title: goalTitle || "this goal", intent: smartSuggestion.intent, amount: smartAmountNumber, unit: state.unit || smartSuggestion.unit, cadence: moneyCadence, startDate: null, endDate: state.endDate || null, targetValue: state.targetValue ? Number(state.targetValue) : null });
    if (!s.text || state.tasks.length >= 10) return;
    if (state.tasks.some((t) => t.toLowerCase() === s.text.toLowerCase())) return;
    update("tasks", [...state.tasks, s.text]);
  }

  async function handleFinish() {
    setSubmitting(true);
    try {
      const title = (state.selectedTemplate?.title ?? state.customTitle).trim();
      if (!title || title.length < 3) throw new Error("Please enter a goal title with at least 3 characters.");
      const category: Category = state.goalCategory ?? state.selectedTemplate?.category ?? smartSuggestion.category ?? (state.selectedCategories[0] ?? "custom");
      const parsedTargetValue = state.targetValue.trim() ? Number(state.targetValue) : undefined;
      if (parsedTargetValue !== undefined && (!Number.isFinite(parsedTargetValue) || parsedTargetValue <= 0)) throw new Error("Target amount must be a positive number.");
      const computedMoneyTarget = smartSuggestion.intent === "money_saving" && smartAmountNumber ? computeCadenceTarget({ amount: smartAmountNumber, cadence: moneyCadence, endDate: state.endDate.trim() || null }) : null;
      const resolvedTargetValue = parsedTargetValue ?? (smartSuggestion.intent === "weight_loss" ? smartAmountNumber ?? undefined : undefined) ?? (computedMoneyTarget ?? undefined);
      const resolvedUnit = state.unit.trim() || smartSuggestion.unit || undefined;
      const preparedTasks = ensureSmartGoalTasks({ title, intent: smartSuggestion.intent, unit: resolvedUnit ?? null, amount: smartAmountNumber ?? resolvedTargetValue ?? null, cadence: moneyCadence, startDate: null, endDate: state.endDate.trim() || null, targetValue: resolvedTargetValue ?? null, tasks: state.tasks.map((text) => ({ text })) });

      const goalRes = await fetch("/api/goals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, why: state.why || undefined, category, color: CATEGORIES.find((c) => c.value === category)?.color ?? "#C4963A", emoji: state.selectedTemplate?.emoji ?? "⭐", targetValue: resolvedTargetValue, unit: resolvedUnit, endDate: state.endDate.trim() || undefined, tasks: preparedTasks.map((t) => ({ text: t.text, isRepeating: true, incrementValue: t.incrementValue })), milestones: [], isPublic: false }) });
      if (!goalRes.ok) { const err = (await goalRes.json()) as { error?: string }; throw new Error(err.error ?? "Failed to create goal"); }

      const completeRes = await fetch("/api/onboarding/complete", { method: "POST" });
      if (!completeRes.ok) console.error("Failed to mark onboarding complete");
      if (state.inviteEmail.trim()) fetch("/api/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: state.inviteEmail.trim(), goalIds: [] }) }).catch(() => null);

      router.push("/dashboard"); router.refresh();
    } catch (err) { toast(err instanceof Error ? err.message : "Something went wrong", "error"); setSubmitting(false); }
  }

  // ─── Carousel phase ──────────────────────────────────────────────────────────

  if (phase === "carousel") {
    return <CarouselPhase onComplete={() => setPhase("wizard")} />;
  }

  // ─── Wizard phase ────────────────────────────────────────────────────────────

  const TOTAL_STEPS = 5;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0E0C0A]">
      <StarField />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-start px-4 py-8 sm:justify-center sm:py-12">
        <div className="mobile-sheet w-full bg-[#171411]/96 px-5 py-6 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:max-w-xl sm:rounded-3xl sm:border sm:border-white/10 sm:px-8 sm:py-8 lg:max-w-2xl">

          {step <= TOTAL_STEPS && (
            <div className="mb-8 flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/6">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L14.4 9.6H22L15.8 14.4L18.2 22L12 17.2L5.8 22L8.2 14.4L2 9.6H9.6L12 2Z" fill="#C4963A" />
                  </svg>
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/35">NorthStar</span>
              </div>
              <ProgressBar step={step} total={TOTAL_STEPS} />
            </div>
          )}

          {/* ── Step 1: Categories ─────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-serif text-white sm:text-4xl">
                  {userName ? `Welcome, ${userName.split(" ")[0]}.` : "Welcome."}
                </h1>
                <p className="mt-3 text-lg font-serif italic text-white/60">What do you want to achieve?</p>
                <p className="mt-1 text-sm text-white/40">Select all that apply — we&apos;ll suggest the best templates.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {CATEGORIES.map((cat) => {
                  const selected = state.selectedCategories.includes(cat.value);
                  return (
                    <button key={cat.value} type="button"
                      onClick={() => update("selectedCategories", selected ? state.selectedCategories.filter((c) => c !== cat.value) : [...state.selectedCategories, cat.value])}
                      className={cn("min-h-[100px] rounded-2xl border p-4 text-left transition-all duration-200", selected ? "border-gold/60 bg-gold/10 text-white" : "border-white/10 bg-white/4 text-white/70 hover:border-white/25 hover:bg-white/8")}>
                      <span className="text-2xl">{cat.emoji}</span>
                      <span className="mt-2 block text-sm font-semibold leading-snug">{cat.label}</span>
                      <span className={cn("mt-1 block text-[11px] leading-4", selected ? "text-white/50" : "text-white/30")}>{cat.hint}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between gap-3">
                <button type="button" onClick={goBack} className="btn-ghost min-h-[48px] rounded-2xl px-5 text-sm text-white/60 hover:text-white">
                  <ArrowLeft className="h-4 w-4" />Back
                </button>
                <button type="button" onClick={goNext} className="btn-gold min-h-[48px] rounded-2xl px-6 text-sm disabled:opacity-40" disabled={state.selectedCategories.length === 0}>
                  Next<ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: First Goal ─────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-3xl font-serif text-white">Your First Goal</h2>
                <p className="mt-2 text-sm text-white/45">Pick a template, create manually, or let AI structure it for you.</p>
              </div>

              {/* AI button */}
              {showAILock ? (
                <PremiumLockBanner onDismiss={() => setShowAILock(false)} />
              ) : (
                <button type="button" onClick={handleAIClick}
                  className={cn("w-full flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all",
                    hasPremiumAI ? "border-gold/40 bg-gold/10 hover:bg-gold/15" : "border-white/15 bg-white/5 hover:border-white/25")}>
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", hasPremiumAI ? "bg-gold/20" : "bg-white/8")}>
                    {hasPremiumAI ? <Sparkles className="h-4 w-4 text-gold" /> : <Lock className="h-4 w-4 text-white/40" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-semibold", hasPremiumAI ? "text-gold" : "text-white/50")}>
                      Generate with AI{!hasPremiumAI && <span className="ml-2 text-[10px] uppercase tracking-wider text-white/30">Premium</span>}
                    </p>
                    <p className="text-xs text-white/35 mt-0.5">Describe your goal and Claude structures it for you</p>
                  </div>
                </button>
              )}

              {/* Templates */}
              {loadingTemplates ? (
                <div className="flex items-center gap-3 py-6 text-white/40">
                  <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Loading suggestions…</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {templates.map((tpl) => {
                    const selected = !state.useCustomGoal && state.selectedTemplate?.id === tpl.id;
                    return (
                      <button key={tpl.id} type="button" onClick={() => selectTemplate(tpl)}
                        className={cn("w-full rounded-2xl border p-4 text-left transition-all duration-200", selected ? "border-gold/60 bg-gold/10" : "border-white/10 bg-white/4 hover:border-white/25 hover:bg-white/8")}>
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{tpl.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-white">{tpl.title}</p>
                            <p className="mt-1 text-sm leading-5 text-white/50">{tpl.description}</p>
                          </div>
                          {selected && <div className="mt-1 h-4 w-4 shrink-0 rounded-full bg-gold" />}
                        </div>
                      </button>
                    );
                  })}
                  <button type="button" onClick={selectCustomGoal}
                    className={cn("w-full rounded-2xl border p-4 text-left transition-all duration-200", state.useCustomGoal ? "border-gold/60 bg-gold/10" : "border-white/10 bg-white/4 hover:border-white/25 hover:bg-white/8")}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">✏️</span>
                      <p className="font-semibold text-white/70">+ Create your own</p>
                    </div>
                  </button>
                </div>
              )}

              {state.useCustomGoal && (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">Goal Title</label>
                  <input type="text" value={state.customTitle} onChange={(e) => update("customTitle", e.target.value)} placeholder="e.g. Run a half marathon"
                    className="w-full rounded-2xl border border-white/15 bg-white/6 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20" maxLength={120} />
                </div>
              )}

              {(state.selectedTemplate || state.useCustomGoal) && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">{smartSuggestion.quantityLabel ?? "Target (optional)"}</label>
                    <input type="number" min="0" step="any"
                      value={smartSuggestion.intent === "generic" ? state.targetValue : smartAmount}
                      onChange={(e) => { if (smartSuggestion.intent === "generic") { update("targetValue", e.target.value); return; } setSmartAmount(e.target.value); if (smartSuggestion.intent === "weight_loss") update("targetValue", e.target.value); }}
                      placeholder="42.2" className="w-full rounded-2xl border border-white/15 bg-white/6 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-gold/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">Unit</label>
                    {smartSuggestion.intent === "reading" ? (
                      <input type="text" value="pages" readOnly className="w-full rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-white/70 outline-none" />
                    ) : smartSuggestion.intent === "money_saving" || smartSuggestion.intent === "weight_loss" ? (
                      <select value={state.unit || smartSuggestion.unit || ""} onChange={(e) => update("unit", e.target.value)} className="w-full rounded-2xl border border-white/15 bg-white/6 px-4 py-3 text-sm text-white outline-none">
                        {smartSuggestion.unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={state.unit} onChange={(e) => update("unit", e.target.value)} placeholder="km" maxLength={20}
                        className="w-full rounded-2xl border border-white/15 bg-white/6 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-gold/50" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">Target Date</label>
                    <input type="date" value={state.endDate} onChange={(e) => update("endDate", e.target.value)}
                      className="w-full rounded-2xl border border-white/15 bg-white/6 px-4 py-3 text-sm text-white outline-none transition focus:border-gold/50" />
                  </div>
                </div>
              )}

              <div className="flex justify-between gap-3">
                <button type="button" onClick={goBack} className="btn-ghost min-h-[48px] rounded-2xl px-5 text-sm text-white/60 hover:text-white">
                  <ArrowLeft className="h-4 w-4" />Back
                </button>
                <button type="button" onClick={goNext} className="btn-gold min-h-[48px] rounded-2xl px-6 text-sm">
                  Next<ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Why ────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-serif text-white leading-tight">What&apos;s driving this?</h2>
                <p className="mt-3 text-base font-serif italic text-white/55">
                  Why does <span className="text-gold/90">&ldquo;{goalTitle}&rdquo;</span> matter to you?
                </p>
              </div>
              <textarea value={state.why} onChange={(e) => update("why", e.target.value)} placeholder="Write anything that comes to mind…" maxLength={500} rows={5}
                className="w-full resize-none rounded-2xl border border-white/15 bg-white/6 px-4 py-3 font-serif text-base italic leading-7 text-white placeholder-white/25 outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20" />
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/30">Need a prompt?</p>
                <div className="flex flex-wrap gap-2">
                  {WHY_SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => update("why", state.why ? `${state.why} ${s.toLowerCase()}` : s)}
                      className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-xs text-white/50 transition hover:border-white/25 hover:text-white/80">{s}</button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between gap-3">
                <button type="button" onClick={goBack} className="btn-ghost min-h-[48px] rounded-2xl px-5 text-sm text-white/60 hover:text-white"><ArrowLeft className="h-4 w-4" />Back</button>
                <button type="button" onClick={goNext} className="btn-gold min-h-[48px] rounded-2xl px-6 text-sm">Next<ArrowRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}

          {/* ── Step 4: Habits ─────────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-serif text-white">Build Your Daily Habit</h2>
                <p className="mt-2 text-sm text-white/45">These appear on your calendar every day as intentions.</p>
              </div>
              {state.tasks.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-3 text-sm text-white/65">
                  <p className="font-semibold text-white/85">Quick start intention</p>
                  <p className="mt-1">Auto-suggest: <span className="text-white">{makeAutoTaskSuggestion({ title: goalTitle || "this goal", intent: smartSuggestion.intent, amount: smartAmountNumber, unit: state.unit || smartSuggestion.unit, cadence: moneyCadence, endDate: state.endDate || null, targetValue: state.targetValue ? Number(state.targetValue) : null }).text}</span></p>
                  <button type="button" onClick={addSmartTask} className="mt-2 inline-flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20">
                    <Sparkles className="h-3.5 w-3.5" />Use smart default
                  </button>
                </div>
              )}
              <div className="space-y-2">
                {state.tasks.map((task, index) => (
                  <div key={`${task}-${index}`} className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-gold/70" />
                    <span className="flex-1 text-sm text-white/85">{task}</span>
                    <button type="button" onClick={() => removeTask(index)} className="shrink-0 text-white/30 hover:text-rose-400"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <input type="text" value={newTask} onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTask(); } }}
                  placeholder="Add a daily action…" maxLength={200}
                  className="flex-1 rounded-2xl border border-white/15 bg-white/6 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-gold/50" />
                <button type="button" onClick={addTask} disabled={!newTask.trim() || state.tasks.length >= 10}
                  className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/8 px-4 py-3 text-sm text-white/70 hover:bg-white/14 disabled:opacity-30">
                  <Plus className="h-4 w-4" />Add
                </button>
              </div>
              <div className="flex justify-between gap-3">
                <button type="button" onClick={goBack} className="btn-ghost min-h-[48px] rounded-2xl px-5 text-sm text-white/60 hover:text-white"><ArrowLeft className="h-4 w-4" />Back</button>
                <button type="button" onClick={goNext} className="btn-gold min-h-[48px] rounded-2xl px-6 text-sm">Next<ArrowRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}

          {/* ── Step 5: Invite ─────────────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-serif text-white">Invite Your Circle</h2>
                <p className="mt-3 text-sm leading-6 text-white/45">
                  Goal tracking is <span className="font-semibold text-gold/80">2×</span> more effective with accountability.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">Friend&apos;s Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input type="email" value={state.inviteEmail} onChange={(e) => update("inviteEmail", e.target.value)} placeholder="friend@example.com"
                    className="w-full rounded-2xl border border-white/15 bg-white/6 py-3 pl-11 pr-4 text-sm text-white placeholder-white/25 outline-none transition focus:border-gold/50" />
                </div>
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button type="button" onClick={goBack} className="btn-ghost min-h-[48px] rounded-2xl px-5 text-sm text-white/60 hover:text-white"><ArrowLeft className="h-4 w-4" />Back</button>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" onClick={goNext} className="min-h-[48px] rounded-2xl border border-white/15 px-5 text-sm text-white/55 hover:border-white/30 hover:text-white/80">Skip</button>
                  <button type="button" onClick={goNext} className="btn-gold min-h-[48px] rounded-2xl px-6 text-sm">Send Invite<ArrowRight className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 6: Celebration ────────────────────────────────────── */}
          {step === 6 && (
            <div className="space-y-8 text-center">
              <div className="space-y-3">
                <h2 className="text-4xl font-serif text-white sm:text-5xl">Your Star is Planted ⭐</h2>
                <p className="text-base text-white/50">Your journey starts now. Every day you show up, your constellation grows.</p>
              </div>
              <ConstellationCanvas goalTitle={goalTitle} />
              <button type="button" onClick={handleFinish} disabled={submitting}
                className="btn-gold mx-auto min-h-[52px] min-w-[200px] justify-center rounded-2xl px-8 text-base disabled:opacity-50">
                {submitting ? (<><Loader2 className="h-5 w-5 animate-spin" />Planting your star…</>) : (<>Let&apos;s go<ArrowRight className="h-5 w-5" /></>)}
              </button>
            </div>
          )}
        </div>
      </div>

      <DecomposeModal open={decomposeOpen} onClose={() => setDecomposeOpen(false)} onAccept={applyDecomposedGoal} />
    </div>
  );
}
