"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { ProgressRing } from "@/components/ui/progress-ring";
import { toast } from "@/components/ui/toaster";
import { cn, formatDate, formatUnit, relativeTime } from "@/lib/utils";
import type { GoalWithDetails } from "@/server/services/goals.service";
import { MomentModal } from "./moment-modal";

interface GoalCardProps {
  goal: GoalWithDetails;
}

const CATEGORY_LABELS: Record<string, string> = {
  health: "Health & Fitness",
  finance: "Finance",
  writing: "Writing & Creative",
  body: "Body Composition",
  mindset: "Mindset & Learning",
  custom: "Custom",
};

export function GoalCard({ goal }: GoalCardProps) {
  const [expanded, setExpanded]           = useState(false);
  const [logValue, setLogValue]           = useState("");
  const [logging, setLogging]             = useState(false);
  const [momentOpen, setMomentOpen]       = useState(false);
  const [optimisticProgress, setOptimisticProgress] = useState<number | null>(null);
  const [completedTaskIds, setCompletedTaskIds]     = useState<Set<string>>(new Set());
  const [savingTask, setSavingTask]       = useState(false);
  const router = useRouter();

  const todayKey = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    if (!expanded) return;
    void fetch(`/api/daily-logs?date=${todayKey}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { log?: { completedTaskIds?: string[] } } | null) => {
        setCompletedTaskIds(new Set(data?.log?.completedTaskIds ?? []));
      });
  }, [expanded, todayKey]);

  const handleToggleTask = useCallback(async (taskId: string) => {
    if (savingTask) return;
    const next = new Set(completedTaskIds);
    next.has(taskId) ? next.delete(taskId) : next.add(taskId);
    setCompletedTaskIds(next);
    setSavingTask(true);
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
  }, [completedTaskIds, savingTask, todayKey, router]);

  const currentValue = optimisticProgress ?? goal.currentValue;
  const percent = goal.targetValue
    ? Math.min(100, Math.round((currentValue / goal.targetValue) * 100))
    : 0;
  const dateRange =
    goal.startDate || goal.endDate
      ? [goal.startDate ? formatDate(goal.startDate) : null, goal.endDate ? formatDate(goal.endDate) : null]
          .filter(Boolean).join(" – ")
      : null;

  const handleLogProgress = async () => {
    const value = parseFloat(logValue);
    if (Number.isNaN(value) || value <= 0) return;
    setLogging(true);
    setOptimisticProgress(currentValue + value);
    try {
      const response = await fetch(`/api/goals/${goal.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!response.ok) throw new Error();
      setLogValue("");
      toast(`Logged ${formatUnit(value, goal.unit)} ✓`);
      router.refresh();
    } catch {
      setOptimisticProgress(null);
      toast("Failed to log progress", "error");
    } finally {
      setLogging(false);
    }
  };

  const handleMilestone = async (milestone: string) => {
    if (goal.completedMilestones?.includes(milestone)) return;
    try {
      const response = await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completeMilestone: milestone }),
      });
      if (!response.ok) throw new Error();
      toast(`Milestone completed!`);
      router.refresh();
    } catch {
      toast("Failed to update milestone", "error");
    }
  };

  return (
    <>
      {/* ── Single unified responsive card ─────────────────── */}
      <article
        className={cn(
          "overflow-hidden rounded-2xl border border-cream-dark bg-cream-paper transition-all duration-200",
          expanded
            ? "shadow-card-hover"
            : "shadow-[0_2px_8px_rgba(26,23,20,0.06)] lg:shadow-none"
        )}
        style={{ borderLeft: `3px solid ${goal.color}` }}
      >
        {/* ── Card Header (always visible) ─────────────────── */}
        <div
          className="cursor-pointer px-4 py-4 sm:px-5 sm:py-4"
          onClick={() => setExpanded((c) => !c)}
        >
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Emoji badge */}
            <div
              className="flex h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm sm:text-base"
              style={{ background: `${goal.color}15` }}
            >
              {goal.emoji ?? "⭐"}
            </div>

            {/* Main content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {/* Category label */}
                  <p
                    className="section-label"
                    style={{ color: goal.color }}
                  >
                    {CATEGORY_LABELS[goal.category] ?? goal.category}
                    {goal.isCompleted && (
                      <span className="ml-2 rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-gold normal-case tracking-normal font-semibold" style={{ fontSize: "0.625rem" }}>
                        Completed
                      </span>
                    )}
                  </p>

                  {/* Title */}
                  <h3 className="mt-1.5 font-serif text-[1.0625rem] font-semibold leading-snug text-ink sm:text-[1.125rem]">
                    {goal.title}
                  </h3>

                  {/* Why quote */}
                  {goal.why && (
                    <p className="mt-1.5 text-sm leading-snug text-ink-muted italic line-clamp-2">
                      &ldquo;{goal.why}&rdquo;
                    </p>
                  )}

                  {/* Metadata row */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-0.5">
                    {dateRange && (
                      <span className="text-xs text-ink-muted">{dateRange}</span>
                    )}
                    {goal.targetValue && (
                      <span className="font-mono text-xs text-ink-muted">
                        {formatUnit(currentValue, goal.unit)} / {formatUnit(goal.targetValue, goal.unit)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress ring */}
                <ProgressRing
                  percent={percent}
                  size={52}
                  strokeWidth={4}
                  color={goal.color}
                  className="flex-shrink-0"
                >
                  <span className="text-[0.6875rem] font-mono font-semibold text-ink">{percent}%</span>
                </ProgressRing>
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-cream-dark">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${percent}%`, background: goal.color }}
                />
              </div>

              {/* Milestones */}
              {goal.milestones.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {goal.milestones.map((milestone) => {
                    const completed = goal.completedMilestones?.includes(milestone);
                    return (
                      <button
                        key={milestone}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); void handleMilestone(milestone); }}
                        className={cn(
                          "h-7 rounded-full border px-3 text-xs font-medium transition-all",
                          completed
                            ? "border-gold/30 bg-gold/10 text-gold"
                            : "border-cream-dark text-ink-muted hover:border-ink-muted hover:text-ink"
                        )}
                      >
                        {completed ? "✓ " : ""}{milestone}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Actions row */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMomentOpen(true); }}
                    className="btn-secondary h-8 rounded-full px-3 text-xs gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Moment</span>
                  </button>
                  <Link
                    href={`/goals/${goal.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="btn-ghost h-8 rounded-full px-3 text-xs"
                  >
                    Details
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setExpanded((c) => !c); }}
                  className="flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-ink"
                >
                  {expanded ? "Less" : "More"}
                  {expanded
                    ? <ChevronUp className="h-3.5 w-3.5" />
                    : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Expanded detail panel ────────────────────────── */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="overflow-hidden border-t border-cream-dark"
            >
              <div className="space-y-5 p-4 sm:p-5">

                {/* Log Progress */}
                {goal.targetValue && (
                  <div className="rounded-xl border border-cream-dark bg-cream p-4">
                    <p className="section-label mb-3">Log Progress</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        value={logValue}
                        onChange={(e) => setLogValue(e.target.value)}
                        placeholder="0"
                        min="0"
                        onKeyDown={(e) => e.key === "Enter" && void handleLogProgress()}
                        className="h-9 w-24 rounded-xl border border-cream-dark bg-cream-paper px-3 text-right text-sm font-mono text-ink outline-none focus:border-ink-muted"
                      />
                      {goal.unit && (
                        <span className="text-sm text-ink-muted">{goal.unit}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleLogProgress()}
                        disabled={logging || !logValue}
                        className="btn-primary ml-auto h-9 rounded-full px-4 text-xs"
                      >
                        {logging ? "Logging…" : "+ Log"}
                      </button>
                    </div>
                    {goal.recentProgress.length > 0 && (
                      <div className="mt-3 space-y-1.5 border-t border-cream-dark pt-3">
                        {goal.recentProgress.slice(0, 3).map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between text-xs">
                            <span className="font-mono font-semibold text-ink">
                              +{formatUnit(entry.value, goal.unit)}
                            </span>
                            <span className="text-ink-muted">{relativeTime(entry.loggedAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Today's Intentions */}
                {goal.tasks.length > 0 && (
                  <div>
                    <p className="section-label mb-2.5">Today&apos;s Intentions</p>
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
                              "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border text-[10px] font-bold",
                              done ? "border-gold bg-gold text-ink" : "border-ink-muted/60"
                            )}>
                              {done && "✓"}
                            </span>
                            <span className={cn("flex-1 leading-snug", done && "line-through opacity-55")}>
                              {task.text}
                            </span>
                            <span className="flex-shrink-0 text-xs text-ink-muted/60">
                              {task.isRepeating ? "Daily" : "Once"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Story Thread */}
                <div>
                  <p className="section-label mb-2.5">Story Thread</p>
                  {goal.recentMoments.length > 0 ? (
                    <div className="space-y-2.5">
                      {goal.recentMoments.map((moment) => (
                        <div key={moment.id} className="relative pl-4">
                          <div
                            className="absolute left-0 top-2 h-1.5 w-1.5 rounded-full"
                            style={{ background: goal.color }}
                          />
                          <p className="text-sm italic leading-relaxed text-ink-soft">
                            {moment.text}
                          </p>
                          <span className="text-xs text-ink-muted">{relativeTime(moment.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-cream-dark px-4 py-3 text-sm italic text-ink-muted">
                      No moments yet. Add a reflection when something meaningful happens.
                    </p>
                  )}
                </div>

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
    </>
  );
}
