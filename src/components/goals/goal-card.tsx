"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { format, differenceInDays, parseISO } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, MoreHorizontal, Pencil, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { ProgressRing } from "@/components/ui/progress-ring";
import { toast } from "@/components/ui/toaster";
import { cn, formatDate, formatUnit, relativeTime } from "@/lib/utils";
import type { GoalWithDetails } from "@/server/services/goals.service";
import { MomentModal } from "./moment-modal";
import { ShareGoalModal } from "./share-goal-modal";
import { CelebrationModal } from "./celebration-modal";

// ── Progress bar color: teal ≥70%, amber 40–69%, coral <40% ──────────
function progressBarColor(pct: number): string {
  if (pct >= 70) return '#1D9E75'  // teal-400
  if (pct >= 40) return '#EF9F27'  // amber-400
  return '#D85A30'                  // coral-400
}

// ── Days remaining badge ──────────────────────────────────────────────
function DaysLeftBadge({ endDate, isCompleted }: { endDate: Date | string | null; isCompleted: boolean | null | undefined }) {
  if (isCompleted || !endDate) return null
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate
  const days = differenceInDays(end, new Date())
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold"
        style={{ background: 'rgba(216,90,48,0.10)', color: '#D85A30', border: '1px solid rgba(216,90,48,0.20)' }}>
        {Math.abs(days)}d overdue
      </span>
    )
  }
  if (days === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold"
        style={{ background: 'rgba(239,159,39,0.10)', color: '#EF9F27', border: '1px solid rgba(239,159,39,0.20)' }}>
        Due today
      </span>
    )
  }
  const color = days <= 7 ? '#EF9F27' : days <= 14 ? '#C4963A' : 'var(--ink-muted)'
  const bg = days <= 7 ? 'rgba(239,159,39,0.08)' : days <= 14 ? 'rgba(196,150,58,0.08)' : 'var(--cream)'
  const border = days <= 7 ? 'rgba(239,159,39,0.2)' : days <= 14 ? 'rgba(196,150,58,0.2)' : 'var(--cream-dark)'
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold"
      style={{ background: bg, color, border: `1px solid ${border}` }}>
      {days}d left
    </span>
  )
}

interface GoalCardProps {
  goal: GoalWithDetails;
  circleMembers?: Array<{ id: string; name: string | null; image: string | null; streak: number }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  health: "Health & Fitness",
  finance: "Finance",
  writing: "Writing & Creative",
  body: "Body Composition",
  mindset: "Mindset & Learning",
  custom: "Custom",
};

export function GoalCard({ goal, circleMembers = [] }: GoalCardProps) {
  const [expanded, setExpanded]           = useState(false);
  const [momentOpen, setMomentOpen]       = useState(false);
  const [shareOpen, setShareOpen]         = useState(false);
  const [menuOpen, setMenuOpen]           = useState(false);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const [savingTask, setSavingTask]       = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [celebration, setCelebration]     = useState(false);
  const [celebrationMsg, setCelebrationMsg] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const router  = useRouter();
  const todayKey = format(new Date(), "yyyy-MM-dd");

  // Load today's completed intentions when expanded
  useEffect(() => {
    if (!expanded) return;
    void fetch(`/api/daily-logs?date=${todayKey}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { log?: { completedTaskIds?: string[] } } | null) => {
        setCompletedTaskIds(new Set(data?.log?.completedTaskIds ?? []));
      });
  }, [expanded, todayKey]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const percent = goal.targetValue
    ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))
    : 0;

  const handleToggleTask = useCallback(async (taskId: string) => {
    if (savingTask) return;
    const wasCompleted = completedTaskIds.has(taskId);
    const next = new Set(completedTaskIds);
    wasCompleted ? next.delete(taskId) : next.add(taskId);
    setCompletedTaskIds(next);
    setSavingTask(true);

    // Show celebration when completing (not unchecking)
    if (!wasCompleted) {
      const completed = next.size;
      const total = goal.tasks.length;
      if (completed === total) {
        setCelebrationMsg(`All ${total} intentions done for today!`);
      } else {
        setCelebrationMsg(`${completed} of ${total} intentions complete.`);
      }
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
  }, [completedTaskIds, savingTask, todayKey, router, goal.tasks.length]);

  const handleDelete = async () => {
    if (!confirm(`Archive "${goal.title}"? You can restore it later from settings.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
      toast("Goal archived");
      router.refresh();
    } catch {
      toast("Failed to archive goal", "error");
      setDeleting(false);
    }
  };

  const handleCardClick = () => {
    router.push(`/goals/${goal.id}`);
  };

  const todayCompleted = goal.tasks.length > 0
    ? goal.tasks.filter((t) => completedTaskIds.has(t.id)).length
    : null;

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleCardClick(); }}
        className={cn(
          "overflow-hidden rounded-2xl border border-cream-dark bg-cream-paper transition-all duration-200 cursor-pointer",
          "hover:shadow-card-hover hover:border-ink-muted/30",
          "active:scale-[0.995]",
          expanded ? "shadow-card-hover" : "shadow-[0_2px_8px_rgba(26,23,20,0.06)] lg:shadow-none"
        )}
        style={{ borderLeft: `3px solid ${goal.color}` }}
      >
        {/* ── Header (always visible) ─── */}
        <div className="px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            {/* Emoji */}
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-base"
              style={{ background: `${goal.color}15` }}
            >
              {goal.emoji ?? "⭐"}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {/* Category + days left row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="section-label" style={{ color: goal.color }}>
                      {CATEGORY_LABELS[goal.category] ?? goal.category}
                    </p>
                    {goal.groupGoalItemId && (
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-600 normal-case tracking-normal font-semibold" style={{ fontSize: "0.6rem" }}>
                        👥 Group
                      </span>
                    )}
                    {goal.isCompleted ? (
                      <span className="rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-gold normal-case tracking-normal font-semibold" style={{ fontSize: "0.6rem" }}>
                        ✓ Done
                      </span>
                    ) : (
                      <DaysLeftBadge endDate={goal.endDate} isCompleted={goal.isCompleted} />
                    )}
                  </div>
                  {/* Title */}
                  <h3 className="mt-1 font-serif text-[1.0625rem] font-semibold leading-snug text-ink sm:text-[1.125rem]">
                    {goal.title}
                  </h3>
                  {/* Why */}
                  {goal.why && (
                    <p className="mt-1 text-sm leading-snug text-ink-muted italic line-clamp-1">
                      &ldquo;{goal.why}&rdquo;
                    </p>
                  )}
                </div>

                {/* Right: progress ring + 3-dot menu */}
                <div className="flex flex-shrink-0 flex-col items-end gap-2">
                  <ProgressRing
                    percent={percent}
                    size={50}
                    strokeWidth={4}
                    color={goal.color}
                  >
                    <span className="text-[0.65rem] font-mono font-semibold text-ink">{percent}%</span>
                  </ProgressRing>

                  {/* 3-dot menu */}
                  <div className="relative" ref={menuRef}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-cream-dark hover:text-ink active:scale-90"
                      aria-label="Goal options"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    <AnimatePresence>
                      {menuOpen && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -4 }}
                          transition={{ duration: 0.12 }}
                          className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-xl border border-cream-dark bg-cream-paper shadow-card-hover"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            href={`/goals/${goal.id}`}
                            onClick={() => setMenuOpen(false)}
                            className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-ink hover:bg-cream transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5 text-ink-muted" />
                            Edit goal
                          </Link>
                          <button
                            type="button"
                            onClick={() => { setMenuOpen(false); setShareOpen(true); }}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-ink hover:bg-cream transition-colors"
                          >
                            <UserPlus className="h-3.5 w-3.5 text-ink-muted" />
                            Add to Circle
                          </button>
                          <div className="my-1 border-t border-cream-dark" />
                          <button
                            type="button"
                            onClick={() => { setMenuOpen(false); void handleDelete(); }}
                            disabled={deleting}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-rose hover:bg-rose/5 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {deleting ? "Archiving…" : "Delete goal"}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 space-y-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-cream-dark">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${percent}%`, background: progressBarColor(percent) }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-ink-muted">
                    {goal.targetValue
                      ? `${formatUnit(goal.currentValue, goal.unit)} of ${formatUnit(goal.targetValue, goal.unit)}`
                      : goal.startDate ? formatDate(goal.startDate) : "Habit goal"}
                  </span>
                  {todayCompleted !== null && expanded && (
                    <span className="text-[10px] text-ink-muted">
                      ✓ {todayCompleted}/{goal.tasks.length} today
                    </span>
                  )}
                </div>
              </div>

              {/* Milestones */}
              {goal.milestones.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {goal.milestones.slice(0, 3).map((milestone) => {
                    const done = goal.completedMilestones?.includes(milestone);
                    return (
                      <span
                        key={milestone}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          done
                            ? "border-gold/30 bg-gold/10 text-gold"
                            : "border-cream-dark text-ink-muted"
                        )}
                      >
                        {done ? "✓ " : ""}{milestone}
                      </span>
                    );
                  })}
                  {goal.milestones.length > 3 && (
                    <span className="rounded-full border border-cream-dark px-2.5 py-0.5 text-xs text-ink-muted">
                      +{goal.milestones.length - 3} more
                    </span>
                  )}
                </div>
              )}

              {/* Action bar */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMomentOpen(true); }}
                    className="btn-secondary h-7 rounded-full px-3 text-xs gap-1"
                  >
                    ✨ Moment
                  </button>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
                  className="flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-ink"
                >
                  {expanded ? "Less" : "Today"}
                  {expanded
                    ? <ChevronUp className="h-3.5 w-3.5" />
                    : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Expanded panel ─── */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="overflow-hidden border-t border-cream-dark"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-4 p-4 sm:p-5">

                {/* Today's Intentions */}
                {goal.tasks.length > 0 ? (
                  <div>
                    <p className="section-label mb-2">
                      📋 Today&apos;s Intentions
                      <span className="ml-2 normal-case tracking-normal font-normal text-ink-muted">
                        — completing these auto-tracks your progress
                      </span>
                    </p>
                    <div className="space-y-1.5">
                      {goal.tasks.map((task) => {
                        const done = completedTaskIds.has(task.id);
                        return (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => void handleToggleTask(task.id)}
                            className={cn(
                              "flex w-full min-h-[40px] items-center gap-3 rounded-xl border px-3.5 py-2 text-left text-sm transition-all",
                              done
                                ? "border-ink bg-ink text-cream-paper"
                                : "border-cream-dark bg-cream text-ink hover:border-ink-muted"
                            )}
                          >
                            <span className={cn(
                              "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border text-[10px] font-bold transition-all",
                              done ? "border-gold bg-gold text-ink" : "border-ink-muted/60"
                            )}>
                              {done && "✓"}
                            </span>
                            <span className={cn("flex-1 leading-snug", done && "line-through opacity-55")}>
                              {task.text}
                            </span>
                            <span className="flex-shrink-0 text-[10px] text-ink-muted/60">
                              {task.isRepeating ? "Daily" : "Once"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-cream-dark px-4 py-3 text-sm text-ink-muted">
                    <Link
                      href={`/goals/${goal.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-ink transition-colors"
                    >
                      + Add daily intentions to start auto-tracking progress →
                    </Link>
                  </div>
                )}

                {/* Story Thread preview */}
                {goal.recentMoments.length > 0 && (
                  <div>
                    <p className="section-label mb-2">💬 Story Thread</p>
                    <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                      {goal.recentMoments.map((moment) => (
                        <div key={moment.id} className="relative pl-4">
                          <div
                            className="absolute left-0 top-2 h-1.5 w-1.5 rounded-full flex-shrink-0"
                            style={{ background: goal.color }}
                          />
                          <p className="text-sm italic leading-relaxed text-ink-soft line-clamp-2">
                            {moment.text}
                          </p>
                          <span className="text-xs text-ink-muted">{relativeTime(moment.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                    <Link
                      href={`/goals/${goal.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 flex items-center text-xs text-ink-muted transition-colors hover:text-ink"
                    >
                      See full story thread →
                    </Link>
                  </div>
                )}

                {/* Collapse */}
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="flex w-full items-center justify-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors"
                >
                  <ChevronUp className="h-4 w-4" />
                  Collapse
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </article>

      <MomentModal
        goalId={goal.id}
        goalTitle={goal.title}
        open={momentOpen}
        onClose={() => setMomentOpen(false)}
      />
      <ShareGoalModal
        goalId={goal.id}
        goalTitle={goal.title}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        circleMembers={circleMembers}
        sharedMemberIds={[]}
      />
      <CelebrationModal
        isOpen={celebration}
        onClose={() => setCelebration(false)}
        title="Great job!"
        message={celebrationMsg}
      />
    </>
  );
}
