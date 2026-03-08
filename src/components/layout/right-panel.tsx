// src/components/layout/right-panel.tsx
import { auth } from "@/lib/auth/config";
import { analyticsService } from "@/server/services/analytics.service";
import { db } from "@/lib/db";
import { goalTasks, dailyLogs, circlePosts, users, circleConnections } from "@/drizzle/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { format } from "date-fns";
import { ConstellationCanvas } from "@/components/analytics/constellation-canvas";
import { relativeTime, initials, cn } from "@/lib/utils";

interface RightPanelProps {
  userId: string;
}

export async function RightPanel({ userId }: RightPanelProps) {
  const today = format(new Date(), "yyyy-MM-dd");

  const [constellationData, tasks, todayLog, circleFeed] = await Promise.all([
    analyticsService.getMomentumData(userId, 30).then((d) => d.constellationData),
    db.select().from(goalTasks).where(eq(goalTasks.userId, userId)).limit(8),
    db
      .select()
      .from(dailyLogs)
      .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, today)))
      .limit(1)
      .then((r) => r[0] ?? null),
    // Fetch circle posts
    (async () => {
      const connections = await db
        .select({ otherId: circleConnections.requesterId })
        .from(circleConnections)
        .where(and(eq(circleConnections.receiverId, userId), eq(circleConnections.status, "accepted")));
      const connections2 = await db
        .select({ otherId: circleConnections.receiverId })
        .from(circleConnections)
        .where(and(eq(circleConnections.requesterId, userId), eq(circleConnections.status, "accepted")));
      const ids = [...connections.map((c) => c.otherId), ...connections2.map((c) => c.otherId)];
      if (ids.length === 0) return [];
      return db
        .select({
          post: circlePosts,
          author: { id: users.id, name: users.name, image: users.image, streak: users.currentStreak },
        })
        .from(circlePosts)
        .leftJoin(users, eq(circlePosts.userId, users.id))
        .where(inArray(circlePosts.userId, ids))
        .orderBy(desc(circlePosts.createdAt))
        .limit(3);
    })(),
  ]);

  const completedIds = new Set(todayLog?.completedTaskIds ?? []);

  return (
    <aside
      className="fixed right-0 top-0 h-screen w-[280px] flex flex-col overflow-y-auto scrollbar-hide"
      style={{
        background: "var(--cream-paper)",
        borderLeft: "1px solid var(--cream-dark)",
      }}
    >
      <div className="p-4 flex flex-col gap-5">
        {/* Constellation */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-2xs font-semibold uppercase tracking-widest text-ink-muted">
              Your Constellation
            </h3>
            <span className="text-2xs text-ink-muted font-mono">30d</span>
          </div>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "#0E0C0A", aspectRatio: "280/160" }}
          >
            <ConstellationCanvas data={constellationData} />
          </div>
        </section>

        {/* Today's Intentions */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-2xs font-semibold uppercase tracking-widest text-ink-muted">
              Today&apos;s Intentions
            </h3>
            <span className="text-2xs font-mono text-ink-muted">
              {completedIds.size}/{tasks.length}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {tasks.length === 0 ? (
              <p className="text-xs text-ink-muted italic">No tasks yet — create a goal with daily tasks.</p>
            ) : (
              tasks.map((task) => {
                const done = completedIds.has(task.id);
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-[1.5px] transition-all text-xs",
                      done
                        ? "border-ink bg-ink text-cream-paper"
                        : "border-cream-dark bg-cream text-ink"
                    )}
                    style={{ borderColor: done ? "var(--ink)" : undefined }}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded flex items-center justify-center flex-shrink-0 text-[9px] border",
                        done
                          ? "bg-gold border-gold text-ink"
                          : "bg-cream-paper border-ink-muted"
                      )}
                    >
                      {done && "✓"}
                    </div>
                    <span className={done ? "line-through opacity-50" : ""}>{task.text}</span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Circle Check-ins */}
        {circleFeed.length > 0 && (
          <section>
            <h3 className="text-2xs font-semibold uppercase tracking-widest text-ink-muted mb-3">
              Circle Check-ins
            </h3>
            <div className="flex flex-col gap-3">
              {circleFeed.map(({ post, author }) => (
                <div key={post.id} className="flex gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-cream-paper overflow-hidden"
                    style={{ background: "#C4963A" }}
                  >
                    {author?.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={author.image} alt={author.name ?? ""} className="w-full h-full object-cover" />
                    ) : (
                      initials(author?.name)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[11px] font-semibold text-ink">{author?.name}</span>
                      {(author?.streak ?? 0) > 0 && (
                        <span className="text-[10px] text-ink-muted">🔥{author?.streak}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-ink-soft italic leading-relaxed line-clamp-2">
                      &ldquo;{post.text}&rdquo;
                    </p>
                    <span className="text-[10px] text-ink-muted">{relativeTime(post.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
