"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { ConstellationCanvas } from "@/components/analytics/constellation-canvas";
import { cn, initials, relativeTime } from "@/lib/utils";
import type { BehaviorIntelligenceData, ConstellationPoint } from "@/server/services/analytics.service";
import { useTodayTasks } from "@/lib/contexts/today-tasks-context";

const RANGE_OPTIONS = [
  { key: "7D", days: 7 },
  { key: "30D", days: 30 },
  { key: "3M", days: 90 },
  { key: "6M", days: 180 },
  { key: "1Y", days: 365 },
] as const;

interface DashboardSidecarProps {
  constellationData: ConstellationPoint[];
  tasks: Array<{ id: string; text: string }>;
  completedTaskIds: string[];
  circleFeed: Array<{
    id: string;
    text: string;
    reactionCounts: Record<string, number>;
    replyCount: number;
    createdAt: Date;
    author: {
      id: string | null;
      name: string | null;
      image: string | null;
      streak: number;
    } | null;
  }>;
  variant?: "page" | "desktop";
  smartSuggestions?: string[];
  showIntentions?: boolean;
  patternInsights?: Pick<
    BehaviorIntelligenceData,
    | "consistencyScore"
    | "followThroughScore"
    | "adaptiveDailyTarget"
    | "bestCheckInWindow"
    | "recommendations"
  > | null;
}

export function DashboardSidecar({
  constellationData,
  tasks,
  completedTaskIds,
  circleFeed,
  smartSuggestions = [],
  showIntentions = true,
  patternInsights = null,
  variant = "page",
}: DashboardSidecarProps) {
  const [activeRange, setActiveRange] =
    useState<(typeof RANGE_OPTIONS)[number]["key"]>("30D");

  const todayTasksCtx = useTodayTasks();
  const selectedRange =
    RANGE_OPTIONS.find((option) => option.key === activeRange) ?? RANGE_OPTIONS[1];
  const selectedPoints = constellationData.slice(-selectedRange.days);
  const activeDays = selectedPoints.filter((point) => point.intensity > 0).length;
  const perfectDays = selectedPoints.filter((point) => point.intensity >= 1).length;
  const completedSet = todayTasksCtx.completedIds ?? new Set(completedTaskIds);

  /* ── Desktop right-panel variant ─────────────────────── */
  if (variant === "desktop") {
    return (
      <aside className="min-w-0 space-y-4">
        {/* Constellation */}
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="section-label">Constellation</p>
            <div className="flex gap-1">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setActiveRange(option.key)}
                  className={cn(
                    "inline-flex min-h-[22px] items-center rounded-full border px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-[0.08em] transition-all",
                    activeRange === option.key
                      ? "border-gold bg-gold text-ink"
                      : "border-white/10 bg-transparent text-white/40 hover:border-white/20 hover:text-white/60"
                  )}
                >
                  {option.key}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-[1rem] border border-[#2A2522] bg-[#171411] p-3.5 text-white shadow-[0_18px_46px_rgba(26,23,20,0.18)]">
            <div className="overflow-hidden rounded-[0.75rem] border border-white/8 bg-[#100d0a]">
              <div className="aspect-[11/8] bg-[radial-gradient(circle_at_top,_rgba(232,201,122,0.18),_rgba(16,13,10,0.98)_52%)]">
                <ConstellationCanvas data={selectedPoints} />
              </div>
            </div>
            <p className="mt-3 text-[0.6875rem] text-[#C9B68D]/70">
              {activeDays} active · {perfectDays} perfect · last {selectedRange.key.toLowerCase()}
            </p>
          </div>
        </section>

        {showIntentions ? (
          <section className="card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="section-label">Today&apos;s Intentions</p>
            <span className="font-mono text-[0.6875rem] text-ink-muted">
              {completedSet.size}/{tasks.length}
            </span>
          </div>

          <div className="space-y-0.5 overflow-hidden">
            {tasks.length === 0 ? (
              <p className="rounded-xl border border-dashed border-cream-dark px-3 py-4 text-sm italic text-ink-muted">
                No intentions set yet.
              </p>
            ) : (() => {
              const incomplete = tasks.filter((t) => !completedSet.has(t.id));
              if (incomplete.length === 0) {
                return (
                  <div className="flex items-center gap-2 rounded-xl border border-cream-dark bg-cream/50 px-3 py-3">
                    <span className="text-base">🎉</span>
                    <span className="text-sm text-ink-muted">All done today!</span>
                  </div>
                );
              }
              return incomplete.map((task) => (
                <div
                  key={task.id}
                  className="flex min-h-[36px] items-center gap-2.5 border-b border-cream-dark px-1 py-1.5 text-ink last:border-b-0"
                  style={{ animation: "fadeIn 0.25s ease" }}
                >
                  <span className="flex h-3.5 w-3.5 flex-shrink-0 rounded-sm border border-ink-muted/50 bg-cream-paper" />
                  <span className="text-sm leading-snug">{task.text}</span>
                </div>
              ));
            })()}
          </div>

          {patternInsights ? (
            <details className="mt-3 rounded-xl border border-cream-dark bg-cream-paper px-3 py-2">
              <summary className="cursor-pointer text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                Your patterns
              </summary>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  { label: "Consistency", value: `${patternInsights.consistencyScore}%` },
                  { label: "Follow-through", value: `${patternInsights.followThroughScore}%` },
                  { label: "Daily load", value: `${patternInsights.adaptiveDailyTarget}` },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-cream-dark bg-cream px-2 py-1.5">
                    <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-ink">{item.value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[0.6875rem] text-ink-muted">
                Best check-in window: <span className="text-ink">{patternInsights.bestCheckInWindow}</span>
              </p>
              <ol className="mt-2 space-y-1.5">
                {patternInsights.recommendations.slice(0, 2).map((tip, index) => (
                  <li key={tip} className="text-[0.75rem] leading-snug text-ink-soft">
                    <span className="mr-1.5 font-mono text-[0.625rem] text-ink-muted">
                      {index + 1}.
                    </span>
                    {tip}
                  </li>
                ))}
              </ol>
            </details>
          ) : null}

          {smartSuggestions.length > 0 ? (
            <details className="mt-3 rounded-xl border border-cream-dark bg-cream-paper px-3 py-2">
              <summary className="cursor-pointer text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                Smart suggestions
              </summary>
              <ol className="mt-2 space-y-1.5">
                {smartSuggestions.slice(0, 2).map((tip, index) => (
                  <li key={tip} className="text-[0.75rem] leading-snug text-ink-soft">
                    <span className="mr-1.5 font-mono text-[0.625rem] text-ink-muted">
                      {index + 1}.
                    </span>
                    {tip}
                  </li>
                ))}
              </ol>
              <Link
                href="/calendar"
                className="mt-2 inline-flex text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-muted transition-colors hover:text-ink"
              >
                Open Daily Log
              </Link>
            </details>
          ) : null}
        </section>
        ) : smartSuggestions.length > 0 ? (
          <section className="card p-4">
            <details className="rounded-xl border border-cream-dark bg-cream-paper px-3 py-2">
              <summary className="cursor-pointer text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                Smart suggestions
              </summary>
              <ol className="mt-2 space-y-1.5">
                {smartSuggestions.slice(0, 2).map((tip, index) => (
                  <li key={tip} className="text-[0.75rem] leading-snug text-ink-soft">
                    <span className="mr-1.5 font-mono text-[0.625rem] text-ink-muted">
                      {index + 1}.
                    </span>
                    {tip}
                  </li>
                ))}
              </ol>
            </details>
          </section>
        ) : null}

        {/* Circle Check-ins */}
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="section-label">Circle</p>
            <Link
              href="/circle"
              className="inline-flex h-7 items-center rounded-full border border-cream-dark px-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-muted transition-colors hover:text-ink"
            >
              Open feed
            </Link>
          </div>

          <div className="space-y-3">
            {circleFeed.length === 0 ? (
              <div className="rounded-xl border border-dashed border-cream-dark px-3 py-5 text-center">
                <Sparkles className="mx-auto h-4 w-4 text-gold" />
                <p className="mt-2 text-sm text-ink-muted">
                  Your circle is quiet. Invite someone from a goal.
                </p>
              </div>
            ) : (
              circleFeed.map((post) => {
                const reactions = [
                  { emoji: "🔥", count: post.reactionCounts["🔥"] ?? 0 },
                  { emoji: "💪", count: post.reactionCounts["💪"] ?? 0 },
                  { emoji: "💙", count: post.reactionCounts["💙"] ?? 0 },
                  { emoji: "✨", count: post.reactionCounts["✨"] ?? 0 },
                ];

                return (
                  <article key={post.id} className="border-b border-cream-dark py-3 last:border-b-0 last:pb-0">
                    <div className="flex items-start gap-2">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold text-[10px] font-bold text-ink">
                        {post.author?.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={post.author.image} alt={post.author.name ?? ""} className="h-full w-full object-cover" />
                        ) : (
                          initials(post.author?.name)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink leading-tight">
                          {post.author?.name ?? "Circle member"}
                        </p>
                        <p className="mt-1 text-sm italic leading-snug text-ink-soft">
                          &ldquo;{post.text}&rdquo;
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {reactions.map((reaction) => (
                        <div
                          key={reaction.emoji}
                          className="inline-flex min-h-[26px] items-center gap-1 rounded-full border border-cream-dark bg-cream-paper px-2.5 text-[0.75rem] text-ink-muted"
                        >
                          <span>{reaction.emoji}</span>
                          {reaction.count > 0 ? <span>{reaction.count}</span> : null}
                        </div>
                      ))}
                      <Link
                        href="/circle"
                        className="inline-flex min-h-[26px] items-center gap-1 rounded-full border border-cream-dark bg-cream-paper px-2.5 text-[0.75rem] font-semibold text-ink-muted transition-colors hover:text-ink"
                      >
                        <MessageCircle className="h-3 w-3" />
                        <span>Reply</span>
                        {post.replyCount > 0 ? <span>({post.replyCount})</span> : null}
                      </Link>
                    </div>

                    <p className="mt-1.5 text-[0.6875rem] text-ink-muted">
                      {relativeTime(post.createdAt)}
                    </p>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </aside>
    );
  }

  /* ── On-page variant (mobile / full-page sidecar) ─────── */
  return (
    <aside className={cn("min-w-0 space-y-5", "xl:sticky xl:top-24")}>
      {/* Constellation */}
      <section className="panel-shell overflow-hidden p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-serif font-semibold text-ink">Constellation</h2>
          <div className="flex flex-wrap gap-1.5">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setActiveRange(option.key)}
                className={cn(
                  "h-7 rounded-full border px-2.5 text-xs font-semibold transition-all",
                  activeRange === option.key
                    ? "border-ink bg-ink text-cream-paper"
                    : "border-cream-dark bg-cream-paper/60 text-ink-muted hover:border-ink-muted hover:text-ink"
                )}
              >
                {option.key}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#100d0a] p-2.5">
          <div className="aspect-[16/10] rounded-[1.25rem] bg-[radial-gradient(circle_at_top,_rgba(232,201,122,0.2),_rgba(16,13,10,0.98)_52%)]">
            <ConstellationCanvas data={selectedPoints} />
          </div>
        </div>

        <p className="mt-3 text-sm text-ink-muted">
          {activeDays} active · {perfectDays} perfect in the last {selectedRange.key.toLowerCase()}
        </p>
      </section>

      {/* Today's Intentions */}
      <section className="panel-shell p-5 sm:p-6">
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <h2 className="text-xl font-serif font-semibold text-ink">Today&apos;s Intentions</h2>
          <span className="rounded-full border border-cream-dark bg-cream-paper px-2.5 py-1 text-xs font-mono text-ink-muted">
            {completedSet.size}/{tasks.length}
          </span>
        </div>

        <div className="space-y-2.5">
          {tasks.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-cream-dark px-4 py-5 text-sm italic text-ink-muted">
              No intentions yet. Plant a new goal and its daily tasks will land here.
            </p>
          ) : (
            tasks.map((task) => {
              const isComplete = completedSet.has(task.id);
              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex min-h-[52px] items-center gap-3 rounded-2xl border px-4 py-3 transition-all",
                    isComplete
                      ? "border-ink bg-ink text-cream-paper"
                      : "border-cream-dark bg-cream-paper/80 text-ink"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
                      isComplete
                        ? "border-gold bg-gold text-ink"
                        : "border-ink-muted/60 bg-cream-paper text-transparent"
                    )}
                  >
                    ✓
                  </span>
                  <span className={cn("text-sm leading-snug", isComplete && "line-through opacity-60")}>
                    {task.text}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Circle Check-ins */}
      <section className="panel-shell p-5 sm:p-6">
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <h2 className="text-xl font-serif font-semibold text-ink">Circle Check-ins</h2>
          <Link
            href="/circle"
            className="text-xs font-bold uppercase tracking-[0.2em] text-gold transition-colors hover:text-ink"
          >
            Open feed
          </Link>
        </div>

        <div className="space-y-3.5">
          {circleFeed.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-cream-dark px-4 py-6 text-center">
              <Sparkles className="mx-auto h-5 w-5 text-gold" />
              <p className="mt-3 text-sm text-ink-muted">
                Your circle is quiet right now. Invite someone from a goal detail screen.
              </p>
            </div>
          ) : (
            circleFeed.map((post) => {
              const reactions = [
                { emoji: "🔥", count: post.reactionCounts["🔥"] ?? 0 },
                { emoji: "💪", count: post.reactionCounts["💪"] ?? 0 },
                { emoji: "💙", count: post.reactionCounts["💙"] ?? 0 },
                { emoji: "✨", count: post.reactionCounts["✨"] ?? 0 },
              ];

              return (
                <article
                  key={post.id}
                  className="rounded-2xl border border-cream-dark bg-cream-paper/80 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold text-sm font-bold text-ink">
                      {post.author?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.author.image} alt={post.author.name ?? ""} className="h-full w-full object-cover" />
                      ) : (
                        initials(post.author?.name)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold text-ink">
                          {post.author?.name ?? "Circle member"}
                        </span>
                        {(post.author?.streak ?? 0) > 0 ? (
                          <span className="text-xs text-ink-muted">🔥 {post.author?.streak}</span>
                        ) : null}
                        <span className="text-xs text-ink-muted">{relativeTime(post.createdAt)}</span>
                      </div>
                      <p className="mt-1.5 text-sm italic leading-snug text-ink-soft">
                        &ldquo;{post.text}&rdquo;
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {reactions.map((reaction) => (
                      <div
                        key={reaction.emoji}
                        className="inline-flex min-h-[30px] items-center gap-1 rounded-full border border-cream-dark bg-cream px-2.5 text-xs text-ink-muted"
                      >
                        <span>{reaction.emoji}</span>
                        {reaction.count > 0 ? <span>{reaction.count}</span> : null}
                      </div>
                    ))}
                    <Link
                      href="/circle"
                      className="inline-flex min-h-[30px] items-center gap-1 rounded-full border border-transparent px-2.5 text-xs font-semibold text-ink-muted transition-colors hover:bg-cream hover:text-ink"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>Reply</span>
                      {post.replyCount > 0 ? <span>({post.replyCount})</span> : null}
                    </Link>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </aside>
  );
}
