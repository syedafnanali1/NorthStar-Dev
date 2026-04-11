"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ProgressRing } from "@/components/ui/progress-ring";
import { MomentModal } from "@/components/goals/moment-modal";
import { ShareGoalModal } from "@/components/goals/share-goal-modal";
import { toast } from "@/components/ui/toaster";
import { cn, formatDate, formatUnit, relativeTime } from "@/lib/utils";
import type { GoalWithDetails } from "@/server/services/goals.service";

interface GoalDetailViewProps {
  goal: GoalWithDetails;
  circleMembers: Array<{
    id: string;
    name: string | null;
    image: string | null;
    streak: number;
  }>;
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

export function GoalDetailView({
  goal,
  circleMembers,
  sharedMemberIds,
}: GoalDetailViewProps) {
  const router = useRouter();
  const [logValue, setLogValue] = useState("");
  const [logging, setLogging] = useState(false);
  const [momentOpen, setMomentOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [optimisticValue, setOptimisticValue] = useState<number | null>(null);

  const currentValue = optimisticValue ?? goal.currentValue;
  const percent = goal.targetValue
    ? Math.min(100, Math.round((currentValue / goal.targetValue) * 100))
    : 0;

  const handleLog = async () => {
    const value = parseFloat(logValue);
    if (Number.isNaN(value) || value <= 0) {
      return;
    }

    setLogging(true);
    setOptimisticValue(currentValue + value);

    try {
      const response = await fetch(`/api/goals/${goal.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });

      if (!response.ok) {
        throw new Error("Failed to log progress");
      }

      setLogValue("");
      toast(`+${formatUnit(value, goal.unit)} logged ✓`);
      router.refresh();
    } catch {
      setOptimisticValue(null);
      toast("Failed to log progress", "error");
    } finally {
      setLogging(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm("Archive this goal? You can restore it later.")) {
      return;
    }

    try {
      await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
      toast("Goal archived");
      router.push("/dashboard");
    } catch {
      toast("Failed to archive goal", "error");
    }
  };

  const heroActions = (
    <>
      <button
        type="button"
        onClick={() => setMomentOpen(true)}
        className="btn-primary min-h-[48px] rounded-2xl px-5"
      >
        Add a Moment
      </button>
      <button
        type="button"
        onClick={() => setShareOpen(true)}
        className="btn-secondary min-h-[48px] rounded-2xl px-5"
      >
        <Share2 className="h-4 w-4" />
        Add to Circle
      </button>
    </>
  );

  const recentProgressList = goal.recentProgress.length > 0 ? (
    <div className="mt-4 space-y-2">
      {goal.recentProgress.slice(0, 5).map((entry) => (
        <div
          key={entry.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cream-dark bg-white/70 px-4 py-3 text-sm"
        >
          <span className="font-mono text-ink">
            +{formatUnit(entry.value, goal.unit)}
          </span>
          {entry.note ? (
            <span className="min-w-0 flex-1 truncate italic text-ink-muted">
              {entry.note}
            </span>
          ) : null}
          <span className="text-ink-muted">{relativeTime(entry.loggedAt)}</span>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <>
      <div className="hidden lg:block space-y-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          All Goals
        </Link>

        <div className="card p-7" style={{ borderLeft: `4px solid ${goal.color}` }}>
          <div className="mb-5 flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                  style={{ color: goal.color }}
                >
                  {CATEGORY_LABELS[goal.category] ?? goal.category}
                </span>
                {goal.isCompleted ? (
                  <span className="rounded-full border border-gold/20 bg-gold/10 px-2.5 py-1 text-[11px] font-semibold text-gold">
                    Completed
                  </span>
                ) : null}
              </div>

              <h1 className="text-3xl font-serif font-semibold text-ink">
                {goal.title}
              </h1>

              {goal.why ? (
                <p className="mt-3 max-w-3xl text-base font-serif italic leading-relaxed text-ink-soft">
                  &ldquo;{goal.why}&rdquo;
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-4 text-xs text-ink-muted">
                {goal.startDate ? <span>Started {formatDate(goal.startDate)}</span> : null}
                {goal.endDate ? <span>Ends {formatDate(goal.endDate)}</span> : null}
                {goal.targetValue ? (
                  <span className="font-mono">
                    {formatUnit(currentValue, goal.unit)} / {formatUnit(goal.targetValue, goal.unit)}
                  </span>
                ) : null}
              </div>
            </div>

            <ProgressRing
              percent={percent}
              size={96}
              strokeWidth={7}
              color={goal.color}
              className="flex-shrink-0"
            >
              <div className="text-center">
                <div className="text-xl font-serif font-bold text-ink">{percent}%</div>
              </div>
            </ProgressRing>
          </div>

          {goal.targetValue ? (
            <div className="mb-4">
              <div className="mb-1.5 flex justify-between text-xs text-ink-muted">
                <span className="font-mono">{formatUnit(currentValue, goal.unit)}</span>
                <span className="font-mono">{formatUnit(goal.targetValue, goal.unit)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-cream-dark">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${percent}%`, background: goal.color }}
                />
              </div>
            </div>
          ) : null}

          <div className="flex gap-3">{heroActions}</div>
        </div>

        {goal.targetValue && !goal.isCompleted ? (
          <div className="card p-5">
            <p className="mb-2 text-xs uppercase tracking-widest text-ink-muted font-semibold">
              Log Progress
            </p>
            <h2 className="text-xl font-serif font-semibold text-ink">Measure the next step</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Capture a measurable move toward this goal.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <input
                type="number"
                value={logValue}
                onChange={(event) => setLogValue(event.target.value)}
                placeholder="0"
                min="0"
                onKeyDown={(event) => event.key === "Enter" && void handleLog()}
                className="w-28 rounded-xl border-[1.5px] border-cream-dark bg-cream px-3 py-2.5 text-right text-sm font-mono text-ink outline-none focus:border-ink-muted"
              />
              {goal.unit ? <span className="text-sm text-ink-muted">{goal.unit}</span> : null}
              <button
                type="button"
                onClick={() => void handleLog()}
                disabled={logging || !logValue}
                className="btn-primary ml-auto disabled:opacity-40"
              >
                {logging ? "Logging..." : "Save"}
              </button>
            </div>
            {recentProgressList}
          </div>
        ) : null}

        {goal.milestones.length > 0 ? (
          <div className="card p-5">
            <h2 className="mb-4 text-xs uppercase tracking-widest text-ink-muted font-semibold">
              Milestones
            </h2>
            <div className="flex flex-wrap gap-2">
              {goal.milestones.map((milestone) => {
                const completed = goal.completedMilestones?.includes(milestone);
                return (
                  <div
                    key={milestone}
                    className={cn(
                      "rounded-full border-[1.5px] px-4 py-2 text-sm font-medium",
                      completed
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-cream-dark text-ink-muted"
                    )}
                  >
                    {completed ? "✓ " : ""}
                    {milestone}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {goal.tasks.length > 0 ? (
          <div className="card p-5">
            <h2 className="mb-4 text-xs uppercase tracking-widest text-ink-muted font-semibold">
              Today&apos;s Intentions
            </h2>
            <div className="space-y-2">
              {goal.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 rounded-xl border-[1.5px] border-cream-dark bg-cream px-4 py-3 text-sm text-ink"
                >
                  <div
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ background: goal.color }}
                  />
                  <span className="flex-1">{task.text}</span>
                  <span className="text-2xs text-ink-muted">
                    {task.isRepeating ? "Daily" : "Once"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-widest text-ink-muted font-semibold">
              Story Thread
            </h2>
            <button onClick={() => setMomentOpen(true)} className="btn-secondary text-xs">
              Add a Moment
            </button>
          </div>
          {goal.recentMoments.length === 0 ? (
            <p className="py-6 text-center text-sm italic text-ink-muted">
              No moments yet. Add your first reflection.
            </p>
          ) : (
            <div className="space-y-4">
              {goal.recentMoments.map((moment) => (
                <div key={moment.id} className="relative pl-5">
                  <div
                    className="absolute left-0 top-2 h-2.5 w-2.5 rounded-full"
                    style={{ background: goal.color }}
                  />
                  <div className="absolute bottom-0 left-[4px] top-4 w-px bg-cream-dark" />
                  <p className="mb-1 text-sm font-serif italic leading-relaxed text-ink-soft">
                    {moment.text}
                  </p>
                  <span className="text-2xs text-ink-muted">
                    {relativeTime(moment.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-xs uppercase tracking-widest text-ink-muted font-semibold">
            Actions
          </h2>
          <button
            type="button"
            onClick={() => void handleArchive()}
            className="text-sm text-ink-muted transition-colors hover:text-rose"
          >
            Archive this goal
          </button>
        </div>
      </div>

      <div className="space-y-6 lg:hidden">
        <Link
          href="/dashboard"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-cream-dark bg-white/70 px-4 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          All Goals
        </Link>

        <section
          className="panel-shell overflow-hidden border-l-4 p-6 sm:p-8"
          style={{ borderLeftColor: goal.color }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex min-h-[36px] items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]"
                  style={{ background: `${goal.color}12`, color: goal.color }}
                >
                  <span>{goal.emoji ?? "⭐"}</span>
                  <span>{CATEGORY_LABELS[goal.category]}</span>
                </span>
                {goal.isCompleted ? (
                  <span className="inline-flex min-h-[36px] items-center rounded-full border border-gold/25 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold">
                    Completed
                  </span>
                ) : null}
              </div>

              <h1 className="mt-4 text-3xl font-serif font-semibold text-ink sm:text-4xl">
                {goal.title}
              </h1>

              {goal.why ? (
                <p className="mt-4 text-base italic leading-7 text-ink-soft sm:text-lg">
                  &ldquo;{goal.why}&rdquo;
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
                {goal.startDate ? <span>Started {formatDate(goal.startDate)}</span> : null}
                {goal.endDate ? <span>Ends {formatDate(goal.endDate)}</span> : null}
                {goal.targetValue ? (
                  <span className="font-mono">
                    {formatUnit(currentValue, goal.unit)} / {formatUnit(goal.targetValue, goal.unit)}
                  </span>
                ) : null}
              </div>
            </div>

            <ProgressRing
              percent={percent}
              size={118}
              strokeWidth={7}
              color={goal.color}
              className="flex-shrink-0"
            >
              <div className="text-center">
                <div className="text-3xl font-serif font-semibold text-ink">
                  {percent}%
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-ink-muted">
                  Progress
                </div>
              </div>
            </ProgressRing>
          </div>

          <div className="mt-6 h-3 overflow-hidden rounded-full bg-cream-dark">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${percent}%`, background: goal.color }}
            />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">{heroActions}</div>
        </section>

        {goal.targetValue && !goal.isCompleted ? (
          <section className="panel-shell p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
                  Log Progress
                </p>
                <h2 className="mt-2 text-2xl font-serif font-semibold text-ink">
                  Measure the next step
                </h2>
                <p className="mt-2 text-sm text-ink-muted">
                  Capture a measurable move toward this goal.
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                <label className="flex min-h-[48px] items-center rounded-2xl border border-cream-dark bg-white px-4">
                  <input
                    type="number"
                    value={logValue}
                    onChange={(event) => setLogValue(event.target.value)}
                    placeholder="0"
                    min="0"
                    onKeyDown={(event) => event.key === "Enter" && void handleLog()}
                    className="w-full bg-transparent text-right text-sm font-mono text-ink outline-none sm:w-24"
                  />
                  {goal.unit ? (
                    <span className="ml-3 text-sm text-ink-muted">{goal.unit}</span>
                  ) : null}
                </label>
                <button
                  type="button"
                  onClick={() => void handleLog()}
                  disabled={logging || !logValue}
                  className="btn-primary min-h-[48px] rounded-2xl px-5 disabled:opacity-40"
                >
                  {logging ? "Logging..." : "Save"}
                </button>
              </div>
            </div>

            {recentProgressList}
          </section>
        ) : null}

        {goal.milestones.length > 0 ? (
          <section className="panel-shell p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
              Milestones
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {goal.milestones.map((milestone) => {
                const completed = goal.completedMilestones?.includes(milestone);
                return (
                  <div
                    key={milestone}
                    className={cn(
                      "min-h-[40px] rounded-full border px-4 py-2 text-sm font-medium",
                      completed
                        ? "border-gold bg-gold/10 text-gold"
                        : "border-cream-dark bg-white/80 text-ink-muted"
                    )}
                  >
                    {completed ? "✓ " : ""}
                    {milestone}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {goal.tasks.length > 0 ? (
          <section className="panel-shell p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
              Today&apos;s Intentions
            </p>
            <div className="mt-4 space-y-2">
              {goal.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-cream-dark bg-white/70 px-4 py-3 text-sm text-ink"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: goal.color }}
                  />
                  <span className="flex-1">{task.text}</span>
                  <span className="text-xs text-ink-muted">
                    {task.isRepeating ? "Daily" : "Once"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="panel-shell p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
                Story Thread
              </p>
              <h2 className="mt-2 text-2xl font-serif font-semibold text-ink">
                Story Thread
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setMomentOpen(true)}
              className="btn-secondary min-h-[48px] rounded-2xl px-5"
            >
              Add a Moment
            </button>
          </div>

          {goal.recentMoments.length === 0 ? (
            <p className="mt-4 rounded-[1.5rem] border border-dashed border-cream-dark px-4 py-6 text-sm italic text-ink-muted">
              No moments yet. Add your first reflection.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              <AnimatePresence initial={false}>
                {goal.recentMoments.map((moment) => (
                  <motion.div
                    key={moment.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-[1.5rem] border border-cream-dark bg-white/75 px-4 py-4"
                  >
                    <p className="text-sm italic leading-6 text-ink-soft">{moment.text}</p>
                    <p className="mt-2 text-xs text-ink-muted">
                      {relativeTime(moment.createdAt)}
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        <section className="panel-shell p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
            Actions
          </p>
          <button
            type="button"
            onClick={() => void handleArchive()}
            className="mt-4 text-sm font-medium text-ink-muted transition-colors hover:text-rose"
          >
            Archive this goal
          </button>
        </section>
      </div>

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
        sharedMemberIds={sharedMemberIds}
      />
    </>
  );
}
