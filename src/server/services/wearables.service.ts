import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  dailyLogs,
  goals,
  progressEntries,
  wearableConnections,
  wearableDataPoints,
  wearableMetricTypeEnum,
  wearableProviderEnum,
} from "@/drizzle/schema";

type WearableProvider = (typeof wearableProviderEnum.enumValues)[number];
type WearableMetricType = (typeof wearableMetricTypeEnum.enumValues)[number];
type SleepEnum = "under_5" | "five_to_6" | "six_to_7" | "seven_to_8" | "over_8";

export interface WearableSampleInput {
  metricType: WearableMetricType;
  value: number;
  recordedAt: string;
  sourcePayload?: Record<string, unknown>;
}

export interface WearableProgressSuggestion {
  goalId: string;
  goalTitle: string;
  metricType: WearableMetricType;
  suggestedValue: number;
  unit: string | null;
  reason: string;
}

function sleepBucket(hours: number): SleepEnum {
  if (hours < 5) return "under_5";
  if (hours < 6) return "five_to_6";
  if (hours < 7) return "six_to_7";
  if (hours < 8) return "seven_to_8";
  return "over_8";
}

function metricMatchesGoal(goalUnit: string | null, metric: WearableMetricType): boolean {
  const unit = (goalUnit ?? "").toLowerCase();
  if (!unit) return false;
  if (metric === "steps") return unit.includes("step");
  if (metric === "distance_km") return unit.includes("km") || unit.includes("mile");
  if (metric === "active_minutes") return unit.includes("minute") || unit.includes("hour");
  if (metric === "sleep_hours") return unit.includes("sleep") || unit.includes("hour");
  return false;
}

export const wearablesService = {
  async connect(userId: string, input: {
    provider: WearableProvider;
    externalUserId?: string;
    accessToken?: string;
    refreshToken?: string;
    scopes?: string[];
  }): Promise<void> {
    const now = new Date();
    await db
      .insert(wearableConnections)
      .values({
        userId,
        provider: input.provider,
        externalUserId: input.externalUserId ?? null,
        accessToken: input.accessToken ?? null,
        refreshToken: input.refreshToken ?? null,
        scopes: input.scopes ?? [],
        isActive: true,
        lastSyncedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [wearableConnections.userId, wearableConnections.provider],
        set: {
          externalUserId: input.externalUserId ?? null,
          accessToken: input.accessToken ?? null,
          refreshToken: input.refreshToken ?? null,
          scopes: input.scopes ?? [],
          isActive: true,
          lastSyncedAt: now,
          updatedAt: now,
        },
      });
  },

  async ingestSamples(
    userId: string,
    provider: WearableProvider,
    samples: WearableSampleInput[]
  ): Promise<{ inserted: number }> {
    if (samples.length === 0) return { inserted: 0 };

    const valid = samples
      .map((sample) => ({
        ...sample,
        recordedAtDate: new Date(sample.recordedAt),
      }))
      .filter(
        (sample) =>
          Number.isFinite(sample.value) &&
          sample.value >= 0 &&
          !Number.isNaN(sample.recordedAtDate.getTime())
      );

    if (valid.length === 0) return { inserted: 0 };

    const result = await db
      .insert(wearableDataPoints)
      .values(
        valid.map((sample) => ({
          userId,
          provider,
          metricType: sample.metricType,
          value: sample.value,
          recordedAt: sample.recordedAtDate,
          sourcePayload: sample.sourcePayload ?? {},
        }))
      )
      .onConflictDoNothing()
      .returning({ id: wearableDataPoints.id });

    await db
      .update(wearableConnections)
      .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(wearableConnections.userId, userId),
          eq(wearableConnections.provider, provider)
        )
      );

    return { inserted: result.length };
  },

  async autoFillSleepForDate(userId: string, date: string): Promise<SleepEnum | null> {
    const [log] = await db
      .select({
        id: dailyLogs.id,
        sleep: dailyLogs.sleep,
      })
      .from(dailyLogs)
      .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.date, date)))
      .limit(1);

    if (!log || log.sleep) return log?.sleep ?? null;

    const dayStart = startOfDay(new Date(`${date}T00:00:00.000Z`));
    const dayEnd = endOfDay(dayStart);
    const [sleepSample] = await db
      .select({ value: wearableDataPoints.value })
      .from(wearableDataPoints)
      .where(
        and(
          eq(wearableDataPoints.userId, userId),
          eq(wearableDataPoints.metricType, "sleep_hours"),
          gte(wearableDataPoints.recordedAt, dayStart),
          lte(wearableDataPoints.recordedAt, dayEnd)
        )
      )
      .orderBy(desc(wearableDataPoints.recordedAt))
      .limit(1);

    if (!sleepSample) return null;

    const bucket = sleepBucket(sleepSample.value);
    await db
      .update(dailyLogs)
      .set({ sleep: bucket, updatedAt: new Date() })
      .where(eq(dailyLogs.id, log.id));

    return bucket;
  },

  async getProgressSuggestions(userId: string, days = 3): Promise<WearableProgressSuggestion[]> {
    const since = subDays(new Date(), days);
    const [goalRows, points] = await Promise.all([
      db
        .select({
          id: goals.id,
          title: goals.title,
          unit: goals.unit,
          category: goals.category,
          targetValue: goals.targetValue,
          currentValue: goals.currentValue,
        })
        .from(goals)
        .where(
          and(
            eq(goals.userId, userId),
            eq(goals.isArchived, false),
            eq(goals.isCompleted, false),
            or(eq(goals.category, "health"), eq(goals.category, "body"))
          )
        ),
      db
        .select({
          metricType: wearableDataPoints.metricType,
          total: sql<number>`COALESCE(sum(${wearableDataPoints.value}), 0)`,
        })
        .from(wearableDataPoints)
        .where(
          and(
            eq(wearableDataPoints.userId, userId),
            gte(wearableDataPoints.recordedAt, since),
            inArray(wearableDataPoints.metricType, [
              "steps",
              "distance_km",
              "active_minutes",
            ])
          )
        )
        .groupBy(wearableDataPoints.metricType),
    ]);

    const totalsByMetric = new Map(points.map((row) => [row.metricType, row.total]));
    const suggestions: WearableProgressSuggestion[] = [];

    for (const goal of goalRows) {
      for (const metric of ["steps", "distance_km", "active_minutes"] as const) {
        if (!metricMatchesGoal(goal.unit, metric)) continue;
        const total = totalsByMetric.get(metric) ?? 0;
        if (total <= 0) continue;

        const normalized =
          metric === "steps"
            ? Math.round(total)
            : metric === "distance_km"
            ? Math.round(total * 100) / 100
            : Math.round(total);

        suggestions.push({
          goalId: goal.id,
          goalTitle: goal.title,
          metricType: metric,
          suggestedValue: normalized,
          unit: goal.unit,
          reason: `Detected ${normalized} ${metric.replace("_", " ")} from ${days}-day wearable sync.`,
        });
      }
    }

    return suggestions.slice(0, 8);
  },

  async applySuggestion(
    userId: string,
    input: { goalId: string; value: number; note?: string }
  ): Promise<void> {
    const [goal] = await db
      .select({
        id: goals.id,
        currentValue: goals.currentValue,
        targetValue: goals.targetValue,
      })
      .from(goals)
      .where(and(eq(goals.id, input.goalId), eq(goals.userId, userId)))
      .limit(1);
    if (!goal) throw new Error("Goal not found");
    if (input.value <= 0) throw new Error("Progress value must be positive");

    await db.insert(progressEntries).values({
      goalId: goal.id,
      userId,
      value: input.value,
      note: input.note ?? "Auto-synced from wearable data",
    });

    const next = goal.currentValue + input.value;
    const completed = goal.targetValue != null ? next >= goal.targetValue : false;

    await db
      .update(goals)
      .set({
        currentValue: next,
        isCompleted: completed,
        completedAt: completed ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(goals.id, goal.id));
  },

  async getLatestHealthSummary(userId: string): Promise<{
    lastSyncAt: Date | null;
    today: Partial<Record<WearableMetricType, number>>;
  }> {
    const todayStart = startOfDay(new Date());
    const [connection, points] = await Promise.all([
      db
        .select({ lastSyncedAt: wearableConnections.lastSyncedAt })
        .from(wearableConnections)
        .where(and(eq(wearableConnections.userId, userId), eq(wearableConnections.isActive, true)))
        .orderBy(desc(wearableConnections.lastSyncedAt))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({
          metricType: wearableDataPoints.metricType,
          total: sql<number>`COALESCE(sum(${wearableDataPoints.value}), 0)`,
        })
        .from(wearableDataPoints)
        .where(
          and(
            eq(wearableDataPoints.userId, userId),
            gte(wearableDataPoints.recordedAt, todayStart)
          )
        )
        .groupBy(wearableDataPoints.metricType),
    ]);

    const today: Partial<Record<WearableMetricType, number>> = {};
    for (const point of points) {
      today[point.metricType] = point.total;
    }

    return {
      lastSyncAt: connection?.lastSyncedAt ?? null,
      today,
    };
  },
};

