import { format } from "date-fns";
import { and, desc, eq, inArray } from "drizzle-orm";
import { DashboardSidecar } from "@/components/dashboard/dashboard-sidecar";
import { goalTasks, dailyLogs, circlePosts, users, circleConnections, goals } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { initials } from "@/lib/utils";
import { analyticsService } from "@/server/services/analytics.service";
import { weeklyDigestService } from "@/server/services/weekly-digest.service";
import Link from "next/link";

interface RightPanelProps {
  userId: string;
  variant?: "default" | "circle" | "calendar";
}

export async function RightPanel({ userId, variant = "default" }: RightPanelProps) {
  if (variant === "circle") {
    const [leaderboard, sharedGoals] = await Promise.all([
      db
        .select({
          id: users.id,
          name: users.name,
          username: users.username,
          image: users.image,
          score: users.momentumScore,
          streak: users.currentStreak,
        })
        .from(users)
        .orderBy(desc(users.momentumScore))
        .limit(10),
      db
        .select({
          id: goals.id,
          title: goals.title,
          emoji: goals.emoji,
          color: goals.color,
          currentValue: goals.currentValue,
          targetValue: goals.targetValue,
        })
        .from(goals)
        .where(and(eq(goals.userId, userId), eq(goals.isArchived, false)))
        .orderBy(desc(goals.updatedAt))
        .limit(4),
    ]);

    return (
      <aside className="fixed right-0 top-0 hidden h-screen w-[var(--right-panel-width)] overflow-y-auto border-l border-cream-dark bg-cream-paper lg:block">
        <div className="space-y-4 px-5 py-6">
          {/* ── Leaderboard ─────────────────────────────── */}
          <section>
            <div className="overflow-hidden rounded-[1rem] border border-[#2A2522] bg-[#171411] p-4 text-white shadow-[0_20px_60px_rgba(26,23,20,0.22)]">
              <p className="section-label" style={{ color: "rgba(199,175,122,0.7)" }}>
                Global Rankings
              </p>
              <h3 className="mt-2 font-serif text-[1.125rem] font-semibold leading-tight text-white">
                Top 10 Leaderboard
              </h3>
              <p className="mt-0.5 text-xs text-white/35">Ranked by momentum score</p>

              <div className="mt-4 space-y-1">
                {leaderboard.map((entry, index) => {
                  const isCurrentUser = entry.id === userId;
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${
                        isCurrentUser ? "bg-[#2A2218]" : ""
                      }`}
                    >
                      <span className="w-4 text-center text-[0.6875rem] font-bold text-white/35">
                        {index + 1}
                      </span>
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold text-[9px] font-bold text-ink">
                        {entry.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={entry.image} alt={entry.name ?? ""} className="h-full w-full object-cover" />
                        ) : (
                          initials(entry.name)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {isCurrentUser ? (
                          <p className="truncate text-xs font-semibold text-white/90">You</p>
                        ) : entry.username ? (
                          <Link
                            href={`/profile/${entry.username}`}
                            className="truncate text-xs font-semibold text-white/90 hover:underline"
                          >
                            {entry.name ?? `@${entry.username}`}
                          </Link>
                        ) : (
                          <p className="truncate text-xs font-semibold text-white/90">
                            {entry.name ?? "Member"}
                          </p>
                        )}
                        <p className="text-[0.625rem] text-white/30">
                          {entry.streak > 0 ? `${entry.streak} streak` : "No streak"}
                        </p>
                      </div>
                      <span className="font-mono text-xs font-semibold text-[#E8C97A]">
                        {entry.score}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ── Your Shared Goals ───────────────────────── */}
          <section className="card p-4">
            <p className="section-label mb-3">Your Goals</p>

            <div className="space-y-2.5">
              {sharedGoals.length === 0 ? (
                <p className="rounded-xl border border-dashed border-cream-dark px-3 py-4 text-sm italic text-ink-muted">
                  No active goals to share yet.
                </p>
              ) : (
                sharedGoals.map((goal) => {
                  const percent =
                    goal.targetValue && goal.targetValue > 0
                      ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))
                      : 0;

                  return (
                    <div key={goal.id} className="rounded-xl border border-cream-dark bg-cream/60 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-ink">
                          {goal.emoji ?? "•"} {goal.title}
                        </p>
                        <span className="font-mono text-xs text-ink-muted flex-shrink-0">{percent}%</span>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-cream-dark">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${percent}%`,
                            background: goal.color ?? "#C4963A",
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </aside>
    );
  }

  const today = format(new Date(), "yyyy-MM-dd");
  const [constellationData, tasks, todayLog, circleFeed, smartSuggestions, patternInsights] =
    await Promise.all([
      analyticsService.getMomentumData(userId, 365).then((data) => data.constellationData),
      db.select().from(goalTasks).where(eq(goalTasks.userId, userId)).limit(6),
      db
        .select()
        .from(dailyLogs)
        .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, today)))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      (async () => {
        const [incoming, outgoing] = await Promise.all([
          db
            .select({ otherId: circleConnections.requesterId })
            .from(circleConnections)
            .where(
              and(
                eq(circleConnections.receiverId, userId),
                eq(circleConnections.status, "accepted")
              )
            ),
          db
            .select({ otherId: circleConnections.receiverId })
            .from(circleConnections)
            .where(
              and(
                eq(circleConnections.requesterId, userId),
                eq(circleConnections.status, "accepted")
              )
            ),
        ]);

        const ids = [
          userId,
          ...incoming.map((connection) => connection.otherId),
          ...outgoing.map((connection) => connection.otherId),
        ];

        if (ids.length === 0) return [];

        return db
          .select({
            post: circlePosts,
            author: {
              id: users.id,
              name: users.name,
              image: users.image,
              streak: users.currentStreak,
            },
          })
          .from(circlePosts)
          .leftJoin(users, eq(circlePosts.userId, users.id))
          .where(inArray(circlePosts.userId, ids))
          .orderBy(desc(circlePosts.createdAt))
          .limit(4);
      })(),
      weeklyDigestService
        .getWeeklyDigestSummary(userId)
        .then((summary) => summary.suggestions)
        .catch(() => [] as string[]),
      analyticsService.getBehaviorIntelligence(userId, 56).catch(() => null),
    ]);

  return (
    <aside className="fixed right-0 top-0 hidden h-screen w-[var(--right-panel-width)] overflow-y-auto border-l border-cream-dark bg-cream-paper lg:block">
      <div className="px-5 py-6">
        <DashboardSidecar
          variant="desktop"
          showIntentions={variant !== "calendar"}
          completedTaskIds={todayLog?.completedTaskIds ?? []}
          constellationData={constellationData}
          patternInsights={patternInsights}
          smartSuggestions={smartSuggestions}
          circleFeed={circleFeed.map(({ post, author }) => ({
            ...post,
            author,
          }))}
          tasks={tasks.map((task) => ({
            id: task.id,
            text: task.text,
          }))}
        />
      </div>
    </aside>
  );
}
