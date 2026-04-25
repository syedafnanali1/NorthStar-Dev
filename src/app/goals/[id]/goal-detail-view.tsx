"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";
import { format, subDays } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, ChevronDown, ChevronUp, Share2, Flame,
  Archive, Plus, Pencil, Trash2, ChevronRight, Check, X, Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ProgressRing } from "@/components/ui/progress-ring";
import { MomentModal } from "@/components/goals/moment-modal";
import { ShareGoalModal } from "@/components/goals/share-goal-modal";
import { CelebrationModal } from "@/components/goals/celebration-modal";
import { toast } from "@/components/ui/toaster";
import { cn, formatDate, formatUnit, relativeTime } from "@/lib/utils";
import type { GoalWithDetails } from "@/server/services/goals.service";

interface GoalDetailViewProps {
  goal: GoalWithDetails;
  currentUserId: string;
  circleMembers: Array<{ id: string; name: string | null; image: string | null; streak: number }>;
  sharedMemberIds: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  health: "Health & Fitness",
  finance: "Finance",
  writing: "Writing & Creative",
  body: "Body Composition",
  mindset: "Mindset & Learning",
  custom: "Custom",
};

const MOOD_EMOJI: Record<string, string> = {
  energized: "⚡", good: "😊", neutral: "😐",
  tired: "😴", low: "😔", focused: "🎯", anxious: "😰",
};

const SLEEP_LABEL: Record<string, string> = {
  under_5: "< 5h", five_to_6: "5–6h", six_to_7: "6–7h",
  seven_to_8: "7–8h", over_8: "8h+",
};

type CoachTone = "encouraging" | "straightforward" | "tough";

interface DailyLog {
  id: string;
  date: string;
  mood: string | null;
  sleep: string | null;
  completedTaskIds: string[];
}

interface FullMoment {
  id: string;
  text: string;
  visibility: string;
  isPerseverance: boolean;
  createdAt: string;
  author?: { id: string; name: string | null; image: string | null } | null;
}

interface AiInsight {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
}

interface LocalTask {
  id: string;
  text: string;
  isRepeating: boolean;
  incrementValue?: number | null;
}

interface Badge {
  id: string;
  emoji: string;
  title: string;
  description: string;
  earned: boolean;
}

function computeBadges(
  goal: GoalWithDetails,
  allMoments: FullMoment[],
  dailyLogs: DailyLog[]
): Badge[] {
  const percent = goal.targetValue
    ? Math.round((goal.currentValue / goal.targetValue) * 100)
    : 0;
  const gritCount = allMoments.filter((m) => m.isPerseverance).length;
  const hasAnyCompletion = dailyLogs.some((l) => (l.completedTaskIds?.length ?? 0) > 0)
    || goal.recentProgress.length > 0;

  return [
    { id: "created", emoji: "🌟", title: "Goal Set", description: "You committed to this goal", earned: true },
    { id: "first-step", emoji: "✅", title: "First Step", description: "Completed your first intention", earned: hasAnyCompletion },
    { id: "milestone", emoji: "🎯", title: "Milestone", description: "Hit your first milestone", earned: (goal.completedMilestones?.length ?? 0) > 0 },
    { id: "halfway", emoji: "🏃", title: "Halfway", description: "Reached 50% completion", earned: percent >= 50 },
    { id: "consistent", emoji: "📅", title: "Consistent", description: "Active 5+ days in a row", earned: dailyLogs.length >= 5 },
    { id: "grit", emoji: "💪", title: "Grit", description: `${gritCount} perseverance moment${gritCount !== 1 ? "s" : ""}`, earned: gritCount >= 2 },
    { id: "storyteller", emoji: "📖", title: "Storyteller", description: "Shared 5+ moments", earned: allMoments.length >= 5 },
    { id: "completed", emoji: "🏆", title: "Achieved", description: "Completed this goal", earned: !!goal.isCompleted },
  ];
}

export function GoalDetailView({
  goal,
  currentUserId,
  circleMembers,
  sharedMemberIds,
}: GoalDetailViewProps) {
  const router = useRouter();
  const isOwner = goal.userId === currentUserId;

  // ── UI State ──────────────────────────────────────────────
  const [momentOpen, setMomentOpen]         = useState(false);
  const [shareOpen, setShareOpen]           = useState(false);
  const [showAllThread, setShowAllThread]   = useState(false);
  const [showTimeline, setShowTimeline]     = useState(false);
  const [celebration, setCelebration]       = useState(false);
  const [celebMsg, setCelebMsg]             = useState("");
  const [coachExpanded, setCoachExpanded]   = useState(false);

  // ── Data State ────────────────────────────────────────────
  const [dailyLogs, setDailyLogs]           = useState<DailyLog[]>([]);
  const [allMoments, setAllMoments]         = useState<FullMoment[]>([]);
  const [aiInsight, setAiInsight]           = useState<AiInsight | null>(null);
  const [coachTone, setCoachTone]           = useState<CoachTone>("encouraging");
  const [loadingMoments, setLoadingMoments] = useState(false);
  const [loadingInsight, setLoadingInsight] = useState(false);

  // ── Intention state (live list synced from goal.tasks) ────
  const [tasks, setTasks]                   = useState<LocalTask[]>(() => goal.tasks.map((t) => ({
    id: t.id, text: t.text, isRepeating: t.isRepeating, incrementValue: t.incrementValue,
  })));
  const [todayTaskIds, setTodayTaskIds]     = useState<Set<string>>(new Set());
  const [savingTask, setSavingTask]         = useState(false);

  // ── Intention editing state ───────────────────────────────
  const [editingTaskId, setEditingTaskId]   = useState<string | null>(null);
  const [editText, setEditText]             = useState("");
  const [addingTask, setAddingTask]         = useState(false);
  const [newTaskText, setNewTaskText]       = useState("");
  const [savingEdit, setSavingEdit]         = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const newTaskInputRef = useRef<HTMLInputElement>(null);
  const todayKey = format(new Date(), "yyyy-MM-dd");

  const currentValue = goal.currentValue;
  const percent = goal.targetValue
    ? Math.min(100, Math.round((currentValue / goal.targetValue) * 100))
    : 0;

  // ── Initial data fetch (logs + moments only) ──────────────
  const fetchLogs = useCallback(async () => {
    const today = new Date();
    const results: DailyLog[] = [];
    const months = [...new Set([format(today, "yyyy-MM"), format(subDays(today, 30), "yyyy-MM")])];
    for (const month of months) {
      try {
        const r = await fetch(`/api/daily-logs?month=${month}`);
        if (r.ok) {
          const data = await r.json() as { logs?: DailyLog[] };
          results.push(...(data.logs ?? []));
        }
      } catch { /* ignore */ }
    }
    setDailyLogs(results);
    const todayLog = results.find((l) => l.date === todayKey);
    setTodayTaskIds(new Set(todayLog?.completedTaskIds ?? []));
  }, [todayKey]);

  const fetchMoments = useCallback(async () => {
    setLoadingMoments(true);
    try {
      const r = await fetch(`/api/goals/${goal.id}/moments`);
      if (r.ok) {
        const data = await r.json() as { moments?: FullMoment[] };
        setAllMoments(data.moments ?? []);
      }
    } finally {
      setLoadingMoments(false);
    }
  }, [goal.id]);

  useEffect(() => {
    void fetchLogs();
    void fetchMoments();
  }, [fetchLogs, fetchMoments]);

  // ── AI insight refetched only when tone changes ───────────
  useEffect(() => {
    setLoadingInsight(true);
    let cancelled = false;
    fetch(`/api/ai-coach/insights?goalId=${goal.id}&limit=1&tone=${coachTone}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { insights?: AiInsight[] } | null) => {
        if (!cancelled) setAiInsight(data?.insights?.[0] ?? null);
      })
      .catch(() => { if (!cancelled) setAiInsight(null); })
      .finally(() => { if (!cancelled) setLoadingInsight(false); });
    return () => { cancelled = true; };
  }, [goal.id, coachTone]);

  // ── Intention toggle ──────────────────────────────────────
  const handleToggleTask = async (taskId: string) => {
    if (savingTask) return;
    const wasCompleted = todayTaskIds.has(taskId);
    const next = new Set(todayTaskIds);
    wasCompleted ? next.delete(taskId) : next.add(taskId);
    setTodayTaskIds(next);
    setSavingTask(true);
    if (!wasCompleted) {
      const done = next.size;
      const total = tasks.length;
      setCelebMsg(done === total ? `All ${total} intentions done for today!` : `${done} of ${total} intentions complete.`);
      setCelebration(true);
    }
    try {
      await fetch("/api/daily-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: todayKey, completedTaskIds: Array.from(next) }),
      });
      router.refresh();
    } finally {
      setSavingTask(false);
    }
  };

  // ── Intention edit (inline) ───────────────────────────────
  const startEdit = (task: LocalTask) => {
    setEditingTaskId(task.id);
    setEditText(task.text);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const cancelEdit = () => {
    setEditingTaskId(null);
    setEditText("");
  };

  const saveEdit = async (taskId: string) => {
    const trimmed = editText.trim();
    if (!trimmed || savingEdit) return;
    setSavingEdit(true);
    try {
      const r = await fetch(`/api/goals/${goal.id}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!r.ok) throw new Error();
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, text: trimmed } : t));
      cancelEdit();
      router.refresh();
    } catch {
      toast("Failed to save", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Intention delete ──────────────────────────────────────
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Remove this intention?")) return;
    try {
      const r = await fetch(`/api/goals/${goal.id}/tasks/${taskId}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      router.refresh();
    } catch {
      toast("Failed to remove intention", "error");
    }
  };

  // ── Intention add ─────────────────────────────────────────
  const startAddTask = () => {
    setAddingTask(true);
    setNewTaskText("");
    setTimeout(() => newTaskInputRef.current?.focus(), 50);
  };

  const saveNewTask = async () => {
    const trimmed = newTaskText.trim();
    if (!trimmed || savingEdit) return;
    if (tasks.length >= 10) { toast("Maximum 10 intentions per goal", "error"); return; }
    setSavingEdit(true);
    try {
      const r = await fetch(`/api/goals/${goal.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, isRepeating: true }),
      });
      if (!r.ok) throw new Error();
      const data = await r.json() as { task: LocalTask };
      setTasks((prev) => [...prev, data.task]);
      setAddingTask(false);
      setNewTaskText("");
      router.refresh();
    } catch {
      toast("Failed to add intention", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Archive ───────────────────────────────────────────────
  const handleArchive = async () => {
    if (!confirm("Archive this goal? You can restore it later.")) return;
    try {
      await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
      toast("Goal archived");
      router.push("/dashboard");
    } catch {
      toast("Failed to archive goal", "error");
    }
  };

  // ── Calendar data ─────────────────────────────────────────
  const today = new Date();
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(today, 29 - i);
    const key = format(d, "yyyy-MM-dd");
    const log = dailyLogs.find((l) => l.date === key);
    const tasksDone = log ? tasks.filter((t) => log.completedTaskIds?.includes(t.id)).length : 0;
    const taskTotal = tasks.length;
    const hasActivity = taskTotal > 0 ? tasksDone > 0 : log != null;
    return { date: d, key, log, tasksDone, taskTotal, hasActivity };
  });

  const gritMoments    = allMoments.filter((m) => m.isPerseverance);
  const threadMoments  = allMoments;
  const visibleThread  = showAllThread ? threadMoments : threadMoments.slice(0, 5);
  const sharedMembers  = circleMembers.filter((m) => sharedMemberIds.includes(m.id));
  const badges         = computeBadges(goal, allMoments, dailyLogs);
  const earnedBadges   = badges.filter((b) => b.earned);

  return (
    <>
      {/* ── Back nav + Archive button ── */}
      <div className="mb-5 flex items-center justify-between">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          All Goals
        </Link>
        <button
          type="button"
          onClick={() => void handleArchive()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-cream-dark px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-rose/40 hover:text-rose"
        >
          <Archive className="h-3.5 w-3.5" />
          Archive
        </button>
      </div>

      <div className="space-y-5">

        {/* ════════ 1. BASIC GOAL DETAILS ════════ */}
        <section className="rounded-2xl border border-cream-dark bg-cream-paper p-5 sm:p-6" style={{ borderLeft: `4px solid ${goal.color}` }}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                  style={{ background: `${goal.color}12`, color: goal.color }}
                >
                  <span>{goal.emoji ?? "⭐"}</span>
                  <span>{CATEGORY_LABELS[goal.category] ?? goal.category}</span>
                </span>
                {goal.groupGoalItemId ? (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-600">👥 Group Goal</span>
                ) : sharedMemberIds.length > 0 ? (
                  <span className="rounded-full border border-violet/20 bg-violet/5 px-3 py-1 text-xs font-semibold text-violet">🤝 Shared</span>
                ) : (
                  <span className="rounded-full border border-cream-dark px-3 py-1 text-xs font-semibold text-ink-muted">Personal</span>
                )}
                {goal.isCompleted && (
                  <span className="rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">🏆 Completed</span>
                )}
              </div>

              <h1 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">{goal.title}</h1>
              {goal.why && <p className="mt-2 text-sm italic leading-relaxed text-ink-soft sm:text-base">&ldquo;{goal.why}&rdquo;</p>}

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
                {goal.startDate && <span>📅 Started {formatDate(goal.startDate)}</span>}
                {goal.endDate   && <span>🏁 Ends {formatDate(goal.endDate)}</span>}
                {goal.targetValue && (
                  <span className="font-mono">{formatUnit(currentValue, goal.unit)} / {formatUnit(goal.targetValue, goal.unit)}</span>
                )}
              </div>
            </div>

            <div className="flex-shrink-0 scale-[0.88] origin-top-right sm:scale-100">
            <ProgressRing percent={percent} size={88} strokeWidth={6} color={goal.color}>
              <div className="text-center">
                <div className="font-serif text-xl font-bold text-ink">{percent}%</div>
                <div className="text-[9px] uppercase tracking-widest text-ink-muted">done</div>
              </div>
            </ProgressRing>
          </div>
          </div>

          {goal.targetValue && (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-cream-dark">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${percent}%`, background: goal.color }} />
              </div>
            </div>
          )}

          {goal.milestones.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {goal.milestones.map((m) => {
                const done = goal.completedMilestones?.includes(m);
                return (
                  <span key={m} className={cn("rounded-full border px-3 py-1 text-xs font-medium", done ? "border-gold/30 bg-gold/10 text-gold" : "border-cream-dark text-ink-muted")}>
                    {done ? "✓ " : ""}{m}
                  </span>
                );
              })}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={() => setMomentOpen(true)} className="btn-primary h-9 rounded-full px-4 text-sm">
              ✨ Add a Moment
            </button>
            <button type="button" onClick={() => setShareOpen(true)} className="btn-secondary h-9 rounded-full px-4 text-sm gap-1.5">
              <Share2 className="h-3.5 w-3.5" />
              Share to Circle
            </button>
          </div>
        </section>

        {/* ════════ 2. INTENTIONS ════════ */}
        <section className="rounded-2xl border border-cream-dark bg-cream-paper p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="section-label">📋 Intentions</p>
              <p className="mt-0.5 text-xs text-ink-muted">Daily actions that auto-track your progress</p>
            </div>
            {isOwner && tasks.length < 10 && !addingTask && (
              <button type="button" onClick={startAddTask} className="btn-secondary h-8 rounded-full px-3 text-xs gap-1">
                <Plus className="h-3 w-3" />
                Add
              </button>
            )}
          </div>

          {tasks.length === 0 && !addingTask ? (
            <div className="rounded-xl border border-dashed border-cream-dark px-4 py-5 text-center">
              <p className="text-sm italic text-ink-muted">No intentions yet.</p>
              {isOwner && (
                <button type="button" onClick={startAddTask} className="mt-2 text-sm text-gold hover:text-ink transition-colors">
                  + Add your first intention
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => {
                const done = todayTaskIds.has(task.id);
                const isEditing = editingTaskId === task.id;

                return (
                  <div key={task.id}>
                    {isEditing ? (
                      /* Inline edit form */
                      <div className="flex items-center gap-2 rounded-xl border border-ink bg-cream px-3 py-2">
                        <input
                          ref={editInputRef}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveEdit(task.id);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          className="flex-1 bg-transparent text-sm text-ink outline-none"
                          placeholder="Intention text…"
                        />
                        <button
                          type="button"
                          onClick={() => void saveEdit(task.id)}
                          disabled={!editText.trim() || savingEdit}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-cream-paper disabled:opacity-40"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={cancelEdit} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:text-ink">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      /* Normal row */
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleToggleTask(task.id)}
                          disabled={savingTask}
                          className={cn(
                            "flex min-h-[44px] flex-1 items-center gap-3 rounded-xl border px-3.5 py-2 text-left text-sm transition-all",
                            done ? "border-ink bg-ink text-cream-paper" : "border-cream-dark bg-cream text-ink hover:border-ink-muted"
                          )}
                        >
                          <span className={cn(
                            "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border text-[10px] font-bold transition-all",
                            done ? "border-gold bg-gold text-ink" : "border-ink-muted/60"
                          )}>
                            {done && "✓"}
                          </span>
                          <span className={cn("flex-1 leading-snug", done && "line-through opacity-55")}>{task.text}</span>
                          <span className="flex-shrink-0 text-[10px] text-ink-muted/60">{task.isRepeating ? "Daily" : "Once"}</span>
                        </button>
                        {isOwner && (
                          <div className="flex gap-0.5">
                            <button
                              type="button"
                              onClick={() => startEdit(task)}
                              className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-cream-dark hover:text-ink active:scale-90"
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteTask(task.id)}
                              className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-rose/5 hover:text-rose active:scale-90"
                              title="Remove"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add new intention inline */}
              {addingTask && (
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-ink bg-cream px-3 py-2">
                  <input
                    ref={newTaskInputRef}
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveNewTask();
                      if (e.key === "Escape") { setAddingTask(false); setNewTaskText(""); }
                    }}
                    placeholder="New intention…"
                    className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
                  />
                  <button
                    type="button"
                    onClick={() => void saveNewTask()}
                    disabled={!newTaskText.trim() || savingEdit}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-cream-paper disabled:opacity-40"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => { setAddingTask(false); setNewTaskText(""); }} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:text-ink">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ════════ 3. COACH NOTES ════════ */}
        <section className="rounded-2xl border border-cream-dark bg-cream-paper p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="section-label">🤖 Coach</p>
              <p className="mt-0.5 text-xs text-ink-muted">AI-powered insights based on your data</p>
            </div>
            <select
              value={coachTone}
              onChange={(e) => setCoachTone(e.target.value as CoachTone)}
              className="h-8 rounded-xl border border-cream-dark bg-cream-paper px-3 text-xs font-semibold text-ink focus:border-ink-muted focus:outline-none cursor-pointer"
            >
              <option value="encouraging">Encouraging</option>
              <option value="straightforward">Straightforward</option>
              <option value="tough">Tough</option>
            </select>
          </div>

          {loadingInsight ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-4 w-3/4 rounded bg-cream-dark" />
              <div className="h-4 w-full rounded bg-cream-dark" />
              <div className="h-4 w-2/3 rounded bg-cream-dark" />
            </div>
          ) : aiInsight ? (
            <div className="space-y-3">
              {aiInsight.title && (
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gold" />
                  <p className="text-sm font-semibold text-ink leading-snug">{aiInsight.title}</p>
                </div>
              )}
              {/* Collapsed: first ~120 chars. Expanded: full body. */}
              <p className="text-sm leading-relaxed text-ink-soft">
                {coachExpanded
                  ? aiInsight.body
                  : (() => {
                      const match = aiInsight.body.match(/^.{30,}?[.!?](?:\s|$)/);
                      const preview = match ? match[0].trim() : aiInsight.body.slice(0, 120).trimEnd() + (aiInsight.body.length > 120 ? "…" : "");
                      return preview;
                    })()
                }
              </p>
              {aiInsight.body.length > 100 && (
                <button
                  type="button"
                  onClick={() => setCoachExpanded((v) => !v)}
                  className="flex items-center gap-1 text-xs font-semibold text-gold/80 transition-colors hover:text-gold"
                >
                  {coachExpanded ? <><ChevronUp className="h-3 w-3" />See less</> : <><ChevronDown className="h-3 w-3" />See more</>}
                </button>
              )}
              {coachExpanded && (
                <div className="rounded-xl border border-cream-dark bg-cream/50 px-4 py-3 space-y-2">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-muted">Pattern Analysis</p>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {[
                      { icon: "🌅", label: "Best time: Morning" },
                      { icon: "📅", label: "Weekdays > Weekends" },
                      { icon: "📈", label: "Trend: Improving" },
                    ].map((hint) => (
                      <span key={hint.label} className="inline-flex items-center gap-1.5 rounded-full border border-cream-dark bg-cream-paper px-3 py-1 text-xs text-ink-muted">
                        <span>{hint.icon}</span>
                        {hint.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-ink-muted">{relativeTime(aiInsight.createdAt)}</p>
            </div>
          ) : (
            <p className="text-sm italic text-ink-muted leading-relaxed">
              Complete a few intentions and your coach will analyse your patterns here.
              The more data, the smarter the insights.
            </p>
          )}
        </section>

        {/* ════════ 4. STORY THREAD ════════ */}
        <section className="rounded-2xl border border-cream-dark bg-cream-paper p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="section-label">💬 Story Thread</p>
              <p className="mt-0.5 text-xs text-ink-muted">{threadMoments.length} entries</p>
            </div>
            <button type="button" onClick={() => setMomentOpen(true)} className="btn-secondary h-8 rounded-full px-3 text-xs">
              + Add
            </button>
          </div>

          {gritMoments.length > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-gold/20 bg-gold/5 px-3 py-2">
              <span className="text-base">💪</span>
              <p className="text-xs text-ink-soft font-medium">
                {gritMoments.length} perseverance moment{gritMoments.length !== 1 ? "s" : ""} — you showed up when it was hard
              </p>
            </div>
          )}

          {loadingMoments && threadMoments.length === 0 ? (
            <div className="py-6 text-center text-sm text-ink-muted">Loading…</div>
          ) : threadMoments.length === 0 ? (
            <p className="rounded-xl border border-dashed border-cream-dark px-4 py-5 text-center text-sm italic text-ink-muted">
              No moments yet. Add your first reflection.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto pr-1">
              <div className="space-y-3">
                {visibleThread.map((m) => (
                  <div key={m.id} className="relative pl-5">
                    <div className="absolute left-0 top-2 h-2 w-2 rounded-full" style={{ background: m.isPerseverance ? "#C4963A" : goal.color }} />
                    <div className="absolute bottom-0 left-[3px] top-4 w-px bg-cream-dark" />
                    {m.author && m.author.id !== currentUserId && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="h-5 w-5 overflow-hidden rounded-full bg-cream-dark flex items-center justify-center text-[9px] font-bold text-ink-muted">
                          {m.author.image
                            ? <Image src={m.author.image} alt={m.author.name ?? ""} width={20} height={20} className="object-cover" />
                            : (m.author.name ?? "?")?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-xs font-medium text-ink-muted">{m.author.name}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-1.5">
                      {m.isPerseverance && <span className="mt-0.5 text-xs font-semibold text-gold">💪</span>}
                      <p className="text-sm italic leading-relaxed text-ink-soft">{m.text}</p>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">{relativeTime(m.createdAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {threadMoments.length > 5 && (
            <button type="button" onClick={() => setShowAllThread((v) => !v)} className="mt-3 flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-ink">
              {showAllThread ? <><ChevronUp className="h-3.5 w-3.5" /> Show less</> : <><ChevronDown className="h-3.5 w-3.5" /> See all {threadMoments.length} entries</>}
            </button>
          )}
        </section>

        {/* ════════ 5. PROGRESS TIMELINE ════════ */}
        <section className="rounded-2xl border border-cream-dark bg-cream-paper p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-label">📊 Progress</p>
              <p className="mt-0.5 text-sm font-medium text-ink">Last 30 days</p>
            </div>
            <Link href="/analytics" className="inline-flex items-center gap-1 text-xs font-semibold text-gold transition-colors hover:text-ink">
              Full analytics <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-[repeat(30,1fr)] gap-0.5">
            {last30.map(({ key, hasActivity, tasksDone, taskTotal }) => (
              <div
                key={key}
                title={`${key}: ${tasksDone}/${taskTotal} intentions`}
                className="aspect-square rounded-sm transition-all"
                style={{
                  background: hasActivity ? goal.color : "#C8BEB5",
                  opacity: hasActivity ? (taskTotal > 0 ? 0.3 + (tasksDone / Math.max(taskTotal, 1)) * 0.7 : 0.6) : 0.12,
                }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-ink-muted">
            <span>30 days ago</span><span>Today</span>
          </div>

          <button type="button" onClick={() => setShowTimeline((v) => !v)} className="mt-3 flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-ink">
            {showTimeline ? <><ChevronUp className="h-3.5 w-3.5" /> Hide detail</> : <><ChevronDown className="h-3.5 w-3.5" /> Day-by-day detail</>}
          </button>

          <AnimatePresence initial={false}>
            {showTimeline && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="mt-4 space-y-1 max-h-64 overflow-y-auto pr-1">
                  {[...last30].reverse().map(({ date, key, log, tasksDone, taskTotal, hasActivity }) => (
                    <div key={key} className={cn("flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs", hasActivity ? "bg-cream" : "bg-transparent")}>
                      <span className="w-20 flex-shrink-0 font-mono text-ink-muted">{format(date, "MMM d, EEE")}</span>
                      <span className={cn("flex-shrink-0", hasActivity ? "text-ink" : "text-ink-muted/40")}>
                        {tasks.length > 0 ? `${tasksDone}/${taskTotal} ✓` : log ? "✓ logged" : "—"}
                      </span>
                      <span className="flex-shrink-0 text-sm" title={log?.mood ?? ""}>{log?.mood ? MOOD_EMOJI[log.mood] ?? "—" : "—"}</span>
                      <span className="flex-shrink-0 text-ink-muted">{log?.sleep ? `😴 ${SLEEP_LABEL[log.sleep]}` : "—"}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ════════ 6. ACHIEVEMENTS ════════ */}
        <section className="rounded-2xl border border-cream-dark bg-cream-paper p-5">
          <div className="mb-4">
            <p className="section-label">🏅 Achievements</p>
            <p className="mt-0.5 text-xs text-ink-muted">{earnedBadges.length} of {badges.length} earned</p>
          </div>

          <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-4">
            {badges.map((badge) => (
              <div
                key={badge.id}
                title={badge.description}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl p-2.5 text-center transition-all",
                  badge.earned ? "border border-gold/20 bg-gold/5" : "border border-cream-dark opacity-35 grayscale"
                )}
              >
                <span className="text-2xl leading-none">{badge.emoji}</span>
                <span className={cn("text-[10px] font-semibold leading-tight", badge.earned ? "text-ink" : "text-ink-muted")}>
                  {badge.title}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Logged", value: goal.recentProgress.length },
              { label: "Milestones", value: `${goal.completedMilestones?.length ?? 0}/${goal.milestones.length}` },
              { label: "Moments", value: allMoments.length },
              { label: "Grit", value: gritMoments.length },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-cream-dark bg-cream/50 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{s.label}</p>
                <p className="mt-1 font-mono text-sm font-semibold text-ink">{s.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ════════ 7. ACCOUNTABILITY CIRCLE (last) ════════ */}
        <section className="rounded-2xl border border-cream-dark bg-cream-paper p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="section-label">👥 Accountability</p>
              <p className="mt-0.5 text-xs text-ink-muted">People keeping you on track</p>
            </div>
            <button type="button" onClick={() => setShareOpen(true)} className="btn-secondary h-8 rounded-full px-3 text-xs gap-1">
              <Plus className="h-3 w-3" />
              Share
            </button>
          </div>

          {sharedMembers.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm italic text-ink-muted leading-relaxed">
                Share this goal with your circle to stay accountable together.
              </p>
              <button type="button" onClick={() => setShareOpen(true)} className="btn-secondary h-9 w-full rounded-xl text-sm">
                Share with Circle
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sharedMembers.map((member) => (
                <Link key={member.id} href={`/profile/${member.id}`} className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-cream">
                  <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-cream-dark">
                    {member.image
                      ? <Image src={member.image} alt={member.name ?? "User"} fill className="object-cover" />
                      : <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-ink-muted">{(member.name ?? "?")?.[0]?.toUpperCase()}</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{member.name ?? "Anonymous"}</p>
                    {member.streak > 0 && (
                      <p className="flex items-center gap-1 text-xs text-ink-muted">
                        <Flame className="h-3 w-3 text-orange-400" />
                        {member.streak}d streak
                      </p>
                    )}
                  </div>
                </Link>
              ))}
              {circleMembers.length > sharedMembers.length && (
                <button type="button" onClick={() => setShareOpen(true)} className="mt-1 flex w-full items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs text-ink-muted transition-colors hover:bg-cream hover:text-ink">
                  <Plus className="h-3.5 w-3.5" />
                  Add more circle members
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      <MomentModal
        goalId={goal.id}
        goalTitle={goal.title}
        open={momentOpen}
        onClose={() => { setMomentOpen(false); void fetchMoments(); }}
      />
      <ShareGoalModal
        goalId={goal.id}
        goalTitle={goal.title}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        circleMembers={circleMembers}
        sharedMemberIds={sharedMemberIds}
      />
      <CelebrationModal
        isOpen={celebration}
        onClose={() => setCelebration(false)}
        title="Intention complete!"
        message={celebMsg}
      />
    </>
  );
}
