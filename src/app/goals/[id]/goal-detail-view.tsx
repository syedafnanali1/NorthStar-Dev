// src/app/goals/[id]/goal-detail-view.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProgressRing } from "@/components/ui/progress-ring";
import { MomentModal } from "@/components/goals/moment-modal";
import { toast } from "@/components/ui/toaster";
import { formatUnit, relativeTime, formatDate, cn } from "@/lib/utils";
import type { GoalWithDetails } from "@/server/services/goals.service";

interface GoalDetailViewProps {
  goal: GoalWithDetails;
}

export function GoalDetailView({ goal }: GoalDetailViewProps) {
  const router = useRouter();
  const [logValue, setLogValue] = useState("");
  const [logging, setLogging] = useState(false);
  const [momentOpen, setMomentOpen] = useState(false);
  const [optimisticValue, setOptimisticValue] = useState<number | null>(null);

  const current = optimisticValue ?? goal.currentValue;
  const pct = goal.targetValue ? Math.min(100, Math.round((current / goal.targetValue) * 100)) : 0;

  const handleLog = async () => {
    const val = parseFloat(logValue);
    if (isNaN(val) || val <= 0) return;
    setLogging(true);
    setOptimisticValue(current + val);
    try {
      const res = await fetch(`/api/goals/${goal.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: val }),
      });
      if (!res.ok) throw new Error();
      setLogValue("");
      toast(`+${formatUnit(val, goal.unit)} logged ✓`);
      router.refresh();
    } catch {
      setOptimisticValue(null);
      toast("Failed to log progress", "error");
    } finally {
      setLogging(false);
    }
  };

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

  const categoryLabels: Record<string, string> = {
    health: "Health & Fitness", finance: "Finance", writing: "Writing & Creative",
    body: "Body Composition", mindset: "Mindset & Learning", custom: "Custom",
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/dashboard" className="text-sm text-ink-muted hover:text-ink flex items-center gap-1">
        ← All Goals
      </Link>

      {/* Hero card */}
      <div className="card p-7" style={{ borderLeft: `4px solid ${goal.color}` }}>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-2xs uppercase tracking-widest font-semibold"
                style={{ color: goal.color }}
              >
                {categoryLabels[goal.category]}
              </span>
              {goal.isCompleted && (
                <span className="badge bg-gold/10 text-gold border border-gold/20">✓ Completed</span>
              )}
            </div>
            <h1 className="text-3xl font-serif font-semibold text-ink mb-2">
              {goal.emoji} {goal.title}
            </h1>
            {goal.why && (
              <p className="text-base font-serif italic text-ink-soft leading-relaxed">
                &ldquo;{goal.why}&rdquo;
              </p>
            )}
          </div>
          <ProgressRing percent={pct} size={96} strokeWidth={7} color={goal.color} className="flex-shrink-0">
            <div className="text-center">
              <div className="text-xl font-serif font-bold text-ink">{pct}%</div>
            </div>
          </ProgressRing>
        </div>

        {/* Metric */}
        {goal.targetValue && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-ink-muted mb-1.5">
              <span className="font-mono">{formatUnit(current, goal.unit)}</span>
              <span className="font-mono">{formatUnit(goal.targetValue, goal.unit)}</span>
            </div>
            <div className="h-2.5 rounded-full bg-cream-dark overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: goal.color }}
              />
            </div>
          </div>
        )}

        {/* Dates */}
        {(goal.startDate || goal.endDate) && (
          <div className="flex gap-4 text-xs text-ink-muted">
            {goal.startDate && <span>Started {formatDate(goal.startDate)}</span>}
            {goal.endDate && <span>Ends {formatDate(goal.endDate)}</span>}
          </div>
        )}
      </div>

      {/* Log Progress */}
      {goal.targetValue && !goal.isCompleted && (
        <div className="card p-5">
          <h2 className="text-xs uppercase tracking-widest text-ink-muted font-semibold mb-4">Log Progress</h2>
          <div className="flex gap-3 items-center">
            <input
              type="number"
              value={logValue}
              onChange={(e) => setLogValue(e.target.value)}
              placeholder="0"
              min="0"
              onKeyDown={(e) => e.key === "Enter" && handleLog()}
              className="w-28 px-3 py-2.5 text-sm text-right rounded-xl border-[1.5px] border-cream-dark bg-cream outline-none focus:border-ink-muted font-mono"
            />
            {goal.unit && <span className="text-sm text-ink-muted">{goal.unit}</span>}
            <button onClick={handleLog} disabled={logging || !logValue} className="btn-primary disabled:opacity-40 ml-auto">
              {logging ? "Logging..." : "+ Log Progress"}
            </button>
          </div>

          {goal.recentProgress.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <p className="text-2xs uppercase tracking-wide text-ink-muted">Recent Entries</p>
              {goal.recentProgress.slice(0, 5).map((e) => (
                <div key={e.id} className="flex items-center justify-between text-xs py-1.5 border-b border-cream-dark last:border-0">
                  <span className="font-mono text-ink">+{formatUnit(e.value, goal.unit)}</span>
                  {e.note && <span className="text-ink-muted flex-1 mx-3 truncate italic">{e.note}</span>}
                  <span className="text-ink-muted">{relativeTime(e.loggedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Milestones */}
      {goal.milestones && goal.milestones.length > 0 && (
        <div className="card p-5">
          <h2 className="text-xs uppercase tracking-widest text-ink-muted font-semibold mb-4">Milestones</h2>
          <div className="flex flex-wrap gap-2">
            {goal.milestones.map((m) => {
              const done = goal.completedMilestones?.includes(m);
              return (
                <div key={m} className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium border-[1.5px]",
                  done ? "border-gold bg-gold/10 text-gold" : "border-cream-dark text-ink-muted"
                )}>
                  {done && "✓ "}{m}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily Tasks */}
      {goal.tasks.length > 0 && (
        <div className="card p-5">
          <h2 className="text-xs uppercase tracking-widest text-ink-muted font-semibold mb-4">
            Linked Daily Tasks
          </h2>
          <div className="space-y-2">
            {goal.tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2.5 px-4 rounded-xl bg-cream border-[1.5px] border-cream-dark text-sm text-ink">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: goal.color }} />
                {t.text}
                <span className="ml-auto text-2xs text-ink-muted">{t.isRepeating ? "Daily" : "Once"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Story Thread (Moments) */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs uppercase tracking-widest text-ink-muted font-semibold">Story Thread</h2>
          <button onClick={() => setMomentOpen(true)} className="btn-secondary text-xs">
            + Add Moment
          </button>
        </div>
        {goal.recentMoments.length === 0 ? (
          <p className="text-sm text-ink-muted italic text-center py-6">
            No moments yet. Add your first reflection.
          </p>
        ) : (
          <div className="space-y-4">
            {goal.recentMoments.map((m) => (
              <div key={m.id} className="relative pl-5">
                <div className="absolute left-0 top-2 w-2.5 h-2.5 rounded-full" style={{ background: goal.color }} />
                <div className="absolute left-[4px] top-4 bottom-0 w-px bg-cream-dark" />
                <p className="font-serif italic text-sm text-ink-soft leading-relaxed mb-1">{m.text}</p>
                <span className="text-2xs text-ink-muted">{relativeTime(m.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="card p-5">
        <h2 className="text-xs uppercase tracking-widest text-ink-muted font-semibold mb-3">Actions</h2>
        <button onClick={handleArchive} className="text-sm text-ink-muted hover:text-rose transition-colors">
          Archive this goal
        </button>
      </div>

      <MomentModal goalId={goal.id} goalTitle={goal.title} open={momentOpen} onClose={() => setMomentOpen(false)} />
    </div>
  );
}
