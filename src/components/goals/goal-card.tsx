// src/components/goals/goal-card.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProgressRing } from "@/components/ui/progress-ring";
import { toast } from "@/components/ui/toaster";
import { cn, formatUnit, relativeTime } from "@/lib/utils";
import type { GoalWithDetails } from "@/server/services/goals.service";
import { MomentModal } from "./moment-modal";

interface GoalCardProps {
  goal: GoalWithDetails;
}

export function GoalCard({ goal }: GoalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [logValue, setLogValue] = useState("");
  const [logging, setLogging] = useState(false);
  const [momentOpen, setMomentOpen] = useState(false);
  const [optimisticProgress, setOptimisticProgress] = useState<number | null>(null);
  const router = useRouter();

  const currentValue = optimisticProgress ?? goal.currentValue;
  const pct = goal.targetValue
    ? Math.min(100, Math.round((currentValue / goal.targetValue) * 100))
    : 0;

  const handleLogProgress = async () => {
    const val = parseFloat(logValue);
    if (isNaN(val) || val <= 0) return;

    setLogging(true);
    // Optimistic update
    setOptimisticProgress(currentValue + val);

    try {
      const res = await fetch(`/api/goals/${goal.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: val }),
      });

      if (!res.ok) throw new Error("Failed to log progress");

      setLogValue("");
      toast(`Logged ${formatUnit(val, goal.unit)} ✓`);
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
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completeMilestone: milestone }),
      });
      if (!res.ok) throw new Error();
      toast(`Milestone "${milestone}" completed! 🎉`);
      router.refresh();
    } catch {
      toast("Failed to update milestone", "error");
    }
  };

  const categoryLabels: Record<string, string> = {
    health: "Health & Fitness",
    finance: "Finance",
    writing: "Writing & Creative",
    body: "Body Composition",
    mindset: "Mindset & Learning",
    custom: "Custom",
  };

  return (
    <>
      <div
        className={cn(
          "card overflow-hidden transition-all duration-300",
          expanded && "shadow-card-hover"
        )}
        style={{ borderLeft: `3px solid ${goal.color}` }}
      >
        {/* Card Header */}
        <div
          className="p-5 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-start gap-4">
            {/* Emoji + category */}
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: `${goal.color}18` }}
            >
              {goal.emoji ?? "⭐"}
            </div>

            {/* Title + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-serif font-semibold text-ink text-lg leading-tight">
                  {goal.title}
                </h3>
                <ProgressRing
                  percent={pct}
                  size={52}
                  strokeWidth={4}
                  color={goal.color}
                  className="flex-shrink-0"
                >
                  <span className="text-[11px] font-mono font-semibold text-ink">
                    {pct}%
                  </span>
                </ProgressRing>
              </div>

              <div className="flex items-center gap-3 mt-1">
                <span
                  className="text-2xs uppercase tracking-wide font-medium"
                  style={{ color: goal.color }}
                >
                  {categoryLabels[goal.category] ?? goal.category}
                </span>
                {goal.targetValue && (
                  <span className="text-2xs text-ink-muted font-mono">
                    {formatUnit(currentValue, goal.unit)} / {formatUnit(goal.targetValue, goal.unit)}
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-1.5 rounded-full bg-cream-dark overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: goal.color,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {expanded && (
          <div
            className="px-5 pb-5 space-y-5"
            style={{ borderTop: "1px solid var(--cream-dark)" }}
          >
            {/* Why statement */}
            {goal.why && (
              <div className="pt-4">
                <p className="text-xs uppercase tracking-widest text-ink-muted mb-1">
                  Why
                </p>
                <p className="text-sm italic font-serif text-ink-soft leading-relaxed">
                  &ldquo;{goal.why}&rdquo;
                </p>
              </div>
            )}

            {/* Progress log input */}
            {goal.targetValue && (
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--cream)" }}
              >
                <p className="text-2xs uppercase tracking-widest text-ink-muted mb-3">
                  Log Progress
                </p>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={logValue}
                    onChange={(e) => setLogValue(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-24 px-3 py-2 text-sm text-right rounded-lg border-[1.5px] border-cream-dark bg-cream-paper outline-none focus:border-ink-muted font-mono"
                    onKeyDown={(e) => e.key === "Enter" && handleLogProgress()}
                  />
                  <span className="text-sm text-ink-muted">{goal.unit}</span>
                  <button
                    onClick={handleLogProgress}
                    disabled={logging || !logValue}
                    className="ml-auto btn-primary text-xs px-4 py-2 disabled:opacity-40"
                  >
                    {logging ? "..." : "+ Log"}
                  </button>
                </div>
                {/* Recent entries */}
                {goal.recentProgress.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {goal.recentProgress.slice(0, 3).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex justify-between text-xs"
                        style={{ color: "var(--ink-muted)" }}
                      >
                        <span className="font-mono">+{formatUnit(entry.value, goal.unit)}</span>
                        <span>{relativeTime(entry.loggedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Milestones */}
            {goal.milestones && goal.milestones.length > 0 && (
              <div>
                <p className="text-2xs uppercase tracking-widest text-ink-muted mb-2">
                  Milestones
                </p>
                <div className="flex flex-wrap gap-2">
                  {goal.milestones.map((m) => {
                    const done = goal.completedMilestones?.includes(m);
                    return (
                      <button
                        key={m}
                        onClick={() => handleMilestone(m)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium border-[1.5px] transition-all",
                          done
                            ? "border-gold bg-gold text-ink"
                            : "border-cream-dark text-ink-muted hover:border-ink-muted"
                        )}
                      >
                        {done && "✓ "}{m}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Daily Tasks */}
            {goal.tasks.length > 0 && (
              <div>
                <p className="text-2xs uppercase tracking-widest text-ink-muted mb-2">
                  Linked Daily Tasks
                </p>
                <div className="space-y-1.5">
                  {goal.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 text-sm text-ink-soft"
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: goal.color }}
                      />
                      {task.text}
                      {task.isRepeating && (
                        <span className="text-2xs text-ink-muted ml-auto">
                          Daily
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Moments (Story Thread) */}
            {goal.recentMoments.length > 0 && (
              <div>
                <p className="text-2xs uppercase tracking-widest text-ink-muted mb-2">
                  Story Thread
                </p>
                <div className="space-y-2">
                  {goal.recentMoments.map((m) => (
                    <div key={m.id} className="relative pl-4">
                      <div
                        className="absolute left-0 top-1.5 w-2 h-2 rounded-full"
                        style={{ background: goal.color }}
                      />
                      <p className="text-xs text-ink-soft italic leading-relaxed">
                        {m.text}
                      </p>
                      <span className="text-2xs text-ink-muted">
                        {relativeTime(m.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setMomentOpen(true)}
                className="btn-secondary text-xs"
              >
                + Add a moment
              </button>
            </div>
          </div>
        )}
      </div>

      <MomentModal
        goalId={goal.id}
        goalTitle={goal.title}
        open={momentOpen}
        onClose={() => setMomentOpen(false)}
      />
    </>
  );
}
