"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronDown, ChevronUp, Share2, Flame } from "lucide-react";
import { useRouter } from "next/navigation";
import { ProgressRing } from "@/components/ui/progress-ring";
import { MomentModal } from "@/components/goals/moment-modal";
import { ShareGoalModal } from "@/components/goals/share-goal-modal";
import { toast } from "@/components/ui/toaster";
import { cn, formatDate, formatUnit, relativeTime } from "@/lib/utils";
import type { GoalWithDetails } from "@/server/services/goals.service";

interface GoalDetailViewProps {
  goal: GoalWithDetails;
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
  energized: "⚡",
  good: "😊",
  neutral: "😐",
  tired: "😴",
  low: "😔",
  focused: "🎯",
  anxious: "😰",
};

const SLEEP_LABEL: Record<string, string> = {
  under_5: "< 5h",
  five_to_6: "5–6h",
  six_to_7: "6–7h",
  seven_to_8: "7–8h",
  over_8: "8h+",
};

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

export function GoalDetailView({ goal, circleMembers, sharedMemberIds }: GoalDetailViewProps) {
  const router = useRouter();

  // State
  const [momentOpen, setMomentOpen]     = useState(false);
  const [shareOpen, setShareOpen]       = useState(false);
  const [optimisticValue]               = useState<number | null>(null);
  const [dailyLogs, setDailyLogs]       = useState<DailyLog[]>([]);
  const [allMoments, setAllMoments]     = useState<FullMoment[]>([]);
  const [aiInsight, setAiInsight]       = useState<AiInsight | null>(null);
  const [showAllThread, setShowAllThread] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [loadingMoments, setLoadingMoments] = useState(false);

  const currentValue = optimisticValue ?? goal.currentValue;
  const percent = goal.targetValue
    ? Math.min(100, Math.round((currentValue / goal.targetValue) * 100))
    : 0;

  // Fetch last 30 days of daily logs for timeline
  const fetchLogs = useCallback(async () => {
    const today = new Date();
    const results: DailyLog[] = [];
    // Fetch current month + prev month
    const months = [
      format(today, "yyyy-MM"),
      format(subDays(today, 30), "yyyy-MM"),
    ];
    for (const month of [...new Set(months)]) {
      try {
        const r = await fetch(`/api/daily-logs?month=${month}`);
        if (r.ok) {
          const data = await r.json() as { logs?: DailyLog[] };
          results.push(...(data.logs ?? []));
        }
      } catch { /* ignore */ }
    }
    setDailyLogs(results);
  }, []);

  // Fetch all moments for this goal
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

  // Fetch AI insight for this goal
  const fetchAiInsight = useCallback(async () => {
    try {
      const r = await fetch(`/api/ai-coach/insights?goalId=${goal.id}&limit=1`);
      if (r.ok) {
        const data = await r.json() as { insights?: AiInsight[] };
        setAiInsight(data.insights?.[0] ?? null);
      }
    } catch { /* graceful */ }
  }, [goal.id]);

  useEffect(() => {
    void fetchLogs();
    void fetchMoments();
    void fetchAiInsight();
  }, [fetchLogs, fetchMoments, fetchAiInsight]);

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

  // Build last-30-days calendar data
  const today = new Date();
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(today, 29 - i);
    const key = format(d, "yyyy-MM-dd");
    const log = dailyLogs.find((l) => l.date === key);
    const tasksDone = log
      ? goal.tasks.filter((t) => log.completedTaskIds?.includes(t.id)).length
      : 0;
    const taskTotal = goal.tasks.length;
    const hasActivity = taskTotal > 0 ? tasksDone > 0 : log != null;
    return { date: d, key, log, tasksDone, taskTotal, hasActivity };
  });

  // Grit moments (perseverance)
  const gritMoments = allMoments.filter((m) => m.isPerseverance);

  // Thread (all non-perseverance + perseverance mixed, sorted by date)
  const threadMoments = allMoments;
  const visibleThread = showAllThread ? threadMoments : threadMoments.slice(0, 5);

  // Shared circle members
  const sharedMembers = circleMembers.filter((m) => sharedMemberIds.includes(m.id));

  return (
    <>
      {/* ── Back nav ─── */}
      <div className="mb-5">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          All Goals
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* ════════════════════ MAIN COLUMN ════════════════════ */}
        <div className="space-y-5 min-w-0">

          {/* ── Goal Hero ─── */}
          <section
            className="rounded-2xl border border-cream-dark bg-cream-paper p-5 sm:p-6"
            style={{ borderLeft: `4px solid ${goal.color}` }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                    style={{ background: `${goal.color}12`, color: goal.color }}
                  >
                    <span>{goal.emoji ?? "⭐"}</span>
                    <span>{CATEGORY_LABELS[goal.category] ?? goal.category}</span>
                  </span>
                  {goal.isCompleted && (
                    <span className="rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
                      🏆 Completed
                    </span>
                  )}
                </div>

                <h1 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">
                  {goal.title}
                </h1>

                {goal.why && (
                  <p className="mt-2 text-sm italic leading-relaxed text-ink-soft sm:text-base">
                    &ldquo;{goal.why}&rdquo;
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
                  {goal.startDate && <span>📅 Started {formatDate(goal.startDate)}</span>}
                  {goal.endDate   && <span>🏁 Ends {formatDate(goal.endDate)}</span>}
                  {goal.targetValue && (
                    <span className="font-mono">
                      {formatUnit(currentValue, goal.unit)} / {formatUnit(goal.targetValue, goal.unit)}
                    </span>
                  )}
                </div>
              </div>

              <ProgressRing
                percent={percent}
                size={88}
                strokeWidth={6}
                color={goal.color}
                className="flex-shrink-0"
              >
                <div className="text-center">
                  <div className="font-serif text-xl font-bold text-ink">{percent}%</div>
                  <div className="text-[9px] uppercase tracking-widest text-ink-muted">done</div>
                </div>
              </ProgressRing>
            </div>

            {goal.targetValue && (
              <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full bg-cream-dark">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${percent}%`, background: goal.color }}
                  />
                </div>
              </div>
            )}

            {/* Milestones */}
            {goal.milestones.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {goal.milestones.map((m) => {
                  const done = goal.completedMilestones?.includes(m);
                  return (
                    <span
                      key={m}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium",
                        done
                          ? "border-gold/30 bg-gold/10 text-gold"
                          : "border-cream-dark text-ink-muted"
                      )}
                    >
                      {done ? "✓ " : ""}{m}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Hero actions */}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMomentOpen(true)}
                className="btn-primary h-9 rounded-full px-4 text-sm"
              >
                ✨ Add a Moment
              </button>
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="btn-secondary h-9 rounded-full px-4 text-sm gap-1.5"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share to Circle
              </button>
            </div>
          </section>

          {/* ── Progress Timeline ─── */}
          <section className="rounded-2xl border border-cream-dark bg-cream-paper p-5">
            <button
              type="button"
              onClick={() => setShowTimeline((v) => !v)}
              className="flex w-full items-center justify-between"
            >
              <div>
                <p className="section-label">📊 Progress Timeline</p>
                <p className="mt-0.5 text-sm font-medium text-ink">Last 30 days</p>
              </div>
              {showTimeline
                ? <ChevronUp className="h-4 w-4 text-ink-muted" />
                : <ChevronDown className="h-4 w-4 text-ink-muted" />}
            </button>

            {/* Mini heatmap — always visible */}
            <div className="mt-4 grid grid-cols-[repeat(30,1fr)] gap-0.5">
              {last30.map(({ key, hasActivity, log, tasksDone, taskTotal }) => (
                <div
                  key={key}
                  title={`${key}: ${tasksDone}/${taskTotal} intentions`}
                  className={cn(
                    "aspect-square rounded-sm transition-all",
                    hasActivity
                      ? "opacity-100"
                      : "opacity-20"
                  )}
                  style={{
                    background: hasActivity
                      ? goal.color
                      : "#C8BEB5",
                    opacity: hasActivity
                      ? (taskTotal > 0 ? 0.3 + (tasksDone / Math.max(taskTotal, 1)) * 0.7 : 0.6)
                      : 0.15,
                  }}
                />
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-ink-muted">
              <span>30 days ago</span>
              <span>Today</span>
            </div>

            {/* Expanded day-by-day */}
            <AnimatePresence initial={false}>
              {showTimeline && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 space-y-1 max-h-72 overflow-y-auto pr-1">
                    {[...last30].reverse().map(({ date, key, log, tasksDone, taskTotal, hasActivity }) => (
                      <div
                        key={key}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs",
                          hasActivity ? "bg-cream" : "bg-transparent"
                        )}
                      >
                        <span className="w-20 flex-shrink-0 font-mono text-ink-muted">
                          {format(date, "MMM d, EEE")}
                        </span>
                        {/* Intentions */}
                        <span className={cn("flex-shrink-0", hasActivity ? "text-ink" : "text-ink-muted/40")}>
                          {goal.tasks.length > 0
                            ? `${tasksDone}/${taskTotal} ✓`
                            : log ? "✓ logged" : "—"}
                        </span>
                        {/* Mood */}
                        <span className="flex-shrink-0 text-sm" title={log?.mood ?? ""}>
                          {log?.mood ? MOOD_EMOJI[log.mood] ?? "—" : "—"}
                        </span>
                        {/* Sleep */}
                        <span className="flex-shrink-0 text-ink-muted">
                          {log?.sleep ? `😴 ${SLEEP_LABEL[log.sleep]}` : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* ── Moments of Grit ─── */}
          {gritMoments.length > 0 && (
            <section className="rounded-2xl border border-cream-dark bg-cream-paper p-5">
              <p className="section-label mb-1">💪 Moments of Grit</p>
              <p className="mb-3 text-xs text-ink-muted">
                Times you showed up even when you didn&apos;t feel like it
              </p>
              <div className="space-y-3">
                {gritMoments.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl border border-gold/20 bg-gold/5 px-4 py-3"
                  >
                    <p className="text-sm italic leading-relaxed text-ink-soft">{m.text}</p>
                    <p className="mt-1.5 text-xs text-ink-muted">{relativeTime(m.createdAt)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Story Thread ─── */}
          <section className="rounded-2xl border border-cream-dark bg-cream-paper p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="section-label">💬 Story Thread</p>
                <p className="mt-0.5 text-xs text-ink-muted">{threadMoments.length} entries</p>
              </div>
              <button
                type="button"
                onClick={() => setMomentOpen(true)}
                className="btn-secondary h-8 rounded-full px-3 text-xs"
              >
                + Add
              </button>
            </div>

            {loadingMoments && threadMoments.length === 0 ? (
              <div className="py-6 text-center text-sm text-ink-muted">Loading…</div>
            ) : threadMoments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-cream-dark px-4 py-5 text-center text-sm italic text-ink-muted">
                No moments yet. Add your first reflection.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto pr-1">
                <div className="space-y-3">
                  {visibleThread.map((m) => (
                    <div key={m.id} className="relative pl-5">
                      <div
                        className="absolute left-0 top-2 h-2 w-2 rounded-full flex-shrink-0"
                        style={{ background: m.isPerseverance ? "#C4963A" : goal.color }}
                      />
                      <div className="absolute bottom-0 left-[3px] top-4 w-px bg-cream-dark" />
                      <div className="flex items-start gap-1.5">
                        {m.isPerseverance && (
                          <span className="mt-0.5 flex-shrink-0 text-xs font-semibold text-gold">💪</span>
                        )}
                        <p className="text-sm italic leading-relaxed text-ink-soft">
                          {m.text}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">{relativeTime(m.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {threadMoments.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllThread((v) => !v)}
                className="mt-3 flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-ink"
              >
                {showAllThread
                  ? <><ChevronUp className="h-3.5 w-3.5" /> Show less</>
                  : <><ChevronDown className="h-3.5 w-3.5" /> See all {threadMoments.length} entries</>}
              </button>
            )}
          </section>

          {/* ── Danger zone ─── */}
          <section className="rounded-2xl border border-cream-dark bg-cream-paper p-5">
            <p className="section-label mb-3">⚙️ Actions</p>
            <button
              type="button"
              onClick={() => void handleArchive()}
              className="text-sm text-ink-muted transition-colors hover:text-rose"
            >
              Archive this goal
            </button>
          </section>
        </div>

        {/* ════════════════════ SIDEBAR ════════════════════ */}
        <div className="space-y-5">

          {/* ── AI Coach Notes ─── */}
          <section className="rounded-2xl border border-cream-dark bg-cream-paper p-5">
            <p className="section-label mb-3">🤖 Coach Notes</p>
            {aiInsight ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-ink">{aiInsight.title}</p>
                <p className="text-sm leading-relaxed text-ink-soft">{aiInsight.body}</p>
                <p className="text-xs text-ink-muted">{relativeTime(aiInsight.createdAt)}</p>
              </div>
            ) : (
              <p className="text-sm italic text-ink-muted leading-relaxed">
                Complete a few intentions and your AI coach will analyse your patterns and give you personalised notes here.
              </p>
            )}
          </section>

          {/* ── Accountability Circle ─── */}
          <section className="rounded-2xl border border-cream-dark bg-cream-paper p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="section-label">👥 Accountability Circle</p>
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="text-xs text-ink-muted transition-colors hover:text-ink"
              >
                + Share
              </button>
            </div>

            {sharedMembers.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm italic text-ink-muted">
                  Share this goal with your circle to keep each other accountable.
                </p>
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="btn-secondary h-8 w-full rounded-xl text-xs"
                >
                  Share with Circle
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {sharedMembers.map((member) => (
                  <Link
                    key={member.id}
                    href={`/profile/${member.id}`}
                    className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-cream"
                  >
                    <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full bg-cream-dark">
                      {member.image ? (
                        <Image
                          src={member.image}
                          alt={member.name ?? "User"}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-ink-muted">
                          {(member.name ?? "?")[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {member.name ?? "Anonymous"}
                      </p>
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
                  <button
                    type="button"
                    onClick={() => setShareOpen(true)}
                    className="mt-1 flex w-full items-center gap-1 text-xs text-ink-muted transition-colors hover:text-ink"
                  >
                    + Add more circle members
                  </button>
                )}
              </div>
            )}
          </section>

          {/* ── Quick stats ─── */}
          <section className="rounded-2xl border border-cream-dark bg-cream-paper p-5">
            <p className="section-label mb-3">📈 Quick Stats</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-muted">Total entries logged</span>
                <span className="font-mono text-sm font-semibold text-ink">
                  {goal.recentProgress.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-muted">Milestones hit</span>
                <span className="font-mono text-sm font-semibold text-ink">
                  {goal.completedMilestones?.length ?? 0} / {goal.milestones.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-muted">Story moments</span>
                <span className="font-mono text-sm font-semibold text-ink">
                  {allMoments.length}
                </span>
              </div>
              {gritMoments.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-muted">💪 Grit moments</span>
                  <span className="font-mono text-sm font-semibold text-gold">
                    {gritMoments.length}
                  </span>
                </div>
              )}
            </div>
          </section>
        </div>
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
    </>
  );
}
