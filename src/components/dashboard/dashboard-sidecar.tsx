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
  const completionPercent =
    tasks.length > 0 ? Math.round((completedSet.size / tasks.length) * 100) : 0;
  const mergedSuggestions = Array.from(
    new Set([...(patternInsights?.recommendations ?? []), ...smartSuggestions])
  )
    .map((tip) => tip.trim())
    .filter((tip) => tip.length > 0)
    .slice(0, 3);

  /* ── Desktop right-panel variant ── */
  if (variant === "desktop") {
    return (
      <aside className="min-w-0 space-y-4">
        {/* ── Insights (was "Patterns & Suggestions") — shown FIRST ── */}
        <section>
          <div className="overflow-hidden rounded-[1rem] border border-[#2A2522] bg-[#171411] p-3.5 text-white shadow-[0_18px_46px_rgba(26,23,20,0.18)]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="section-label" style={{ color: "rgba(199,175,122,0.72)" }}>
                Insights
              </p>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[0.625rem] text-[#D7C299]">
                {tasks.length > 0 ? `${completedSet.size}/${tasks.length}` : "No plan"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: "Steady",
                  value: patternInsights ? `${patternInsights.consistencyScore}%` : `${completionPercent}%`,
                },
                {
                  label: "Commit",
                  value: patternInsights ? `${patternInsights.followThroughScore}%` : `${completionPercent}%`,
                },
                {
                  label: "Load",
                  value: patternInsights ? `${patternInsights.adaptiveDailyTarget}` : `${tasks.length}`,
                },
                {
                  label: "Today",
                  value: tasks.length > 0 ? `${completionPercent}%` : "—",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2"
                >
                  <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.08em] text-white/50">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#F3E7CF]">{item.value}</p>
                </div>
              ))}
            </div>

            <p className="mt-3 text-[0.6875rem] text-[#C9B68D]/80">
              Best window:{" "}
              <span className="font-semibold text-[#F3E7CF]">
                {patternInsights?.bestCheckInWindow ?? "Build 3+ logs to unlock"}
              </span>
            </p>

            <div className="mt-3 rounded-lg border border-white/10 bg-[#100d0a] px-2.5 py-2.5">
              <ol className="space-y-2">
                {mergedSuggestions.length > 0 ? (
                  mergedSuggestions.map((tip, index) => (
                    <li key={tip} className="flex gap-2 text-[0.75rem] leading-snug text-[#E7DCC7]">
                      <span className="mt-[1px] font-mono text-[0.625rem] text-[#C9B68D]">
                        {index + 1}.
                      </span>
                      <span>{tip}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-[0.75rem] leading-snug text-[#B39E7A]">
                    Keep checking in daily to unlock tailored momentum suggestions.
                  </li>
                )}
              </ol>
            </div>

            <Link
              href="/calendar"
              className="mt-3 inline-flex text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[#D7C299] transition-colors hover:text-[#F3E7CF]"
            >
              Open Daily Log
            </Link>
          </div>
        </section>

        {/* ── Constellation — shown SECOND ── */}
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

        {/* ── Circle ── */}
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

  /* ── On-page variant (mobile / full-page sidecar) ── */
  return (
    <aside className={cn("min-w-0 space-y-5", "xl:sticky xl:top-24")}>
      {/* ── Insights — shown FIRST ── */}
      <section className="panel-shell p-5 sm:p-6">
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <h2 className="text-xl font-serif font-semibold text-ink">Insights</h2>
          <span className="rounded-full border border-cream-dark bg-cream-paper px-2.5 py-1 text-xs font-mono text-ink-muted">
            {tasks.length > 0 ? `${completedSet.size}/${tasks.length}` : "No plan"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {[
            {
              label: "Steady",
              value: patternInsights ? `${patternInsights.consistencyScore}%` : `${completionPercent}%`,
            },
            {
              label: "Commit",
              value: patternInsights ? `${patternInsights.followThroughScore}%` : `${completionPercent}%`,
            },
            {
              label: "Load",
              value: patternInsights ? `${patternInsights.adaptiveDailyTarget}` : `${tasks.length}`,
            },
            {
              label: "Today",
              value: tasks.length > 0 ? `${completionPercent}%` : "—",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-cream-dark bg-cream-paper/80 px-3 py-2.5"
            >
              <p className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                {item.label}
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">{item.value}</p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[0.8125rem] text-ink-muted">
          Best window:{" "}
          <span className="font-semibold text-ink">
            {patternInsights?.bestCheckInWindow ?? "Build 3+ logs to unlock"}
          </span>
        </p>

        <div className="mt-3 rounded-2xl border border-cream-dark bg-cream-paper/80 px-4 py-3">
          <ol className="space-y-2">
            {mergedSuggestions.length > 0 ? (
              mergedSuggestions.map((tip, index) => (
                <li key={tip} className="flex gap-2 text-sm leading-snug text-ink-soft">
                  <span className="mt-[1px] font-mono text-[0.6875rem] text-ink-muted">
                    {index + 1}.
                  </span>
                  <span>{tip}</span>
                </li>
              ))
            ) : (
              <li className="text-sm italic text-ink-muted">
                Keep checking in daily to unlock tailored momentum suggestions.
              </li>
            )}
          </ol>
        </div>

        <Link
          href="/calendar"
          className="mt-3 inline-flex text-xs font-bold uppercase tracking-[0.2em] text-gold transition-colors hover:text-ink"
        >
          Open Daily Log
        </Link>
      </section>

      {/* ── Constellation — shown SECOND ── */}
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

      {/* ── Circle ── */}
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
