import { analyticsService } from "@/server/services/analytics.service";
import { db } from "@/lib/db";
import {
  circleConnections,
  circlePosts,
  dailyLogs,
  goalTasks,
  users,
} from "@/drizzle/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { format } from "date-fns";
import { DashboardSidecar } from "./dashboard-sidecar";

interface MobileSidecarServerProps {
  userId: string;
}

export async function MobileSidecarServer({
  userId,
}: MobileSidecarServerProps) {
  const today = format(new Date(), "yyyy-MM-dd");

  const [constellationData, tasks, todayLog, circleFeed] = await Promise.all([
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

      if (ids.length === 0) {
        return [];
      }

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
  ]);

  return (
    <div className="lg:hidden">
      <DashboardSidecar
        completedTaskIds={todayLog?.completedTaskIds ?? []}
        constellationData={constellationData}
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
  );
}
