import type { Metadata } from "next";
import { AppLayout } from "@/components/layout/app-layout";
import { AchievementsGrid } from "@/components/analytics/achievements-grid";
import { CategoryBreakdown } from "@/components/analytics/category-breakdown";
import { LifetimeStats } from "@/components/analytics/lifetime-stats";
import { WeeklyBarChart } from "@/components/analytics/weekly-bar-chart";
import { LifeRadarChart } from "@/components/analytics/life-radar-chart";
import { WeeklyHeatmap } from "@/components/analytics/weekly-heatmap";
import { PaceTracker, type PaceGoal } from "@/components/analytics/pace-tracker";
import { requireAuthUser } from "@/lib/auth/helpers";
import { achievementService } from "@/server/services/achievements.service";
import { analyticsService } from "@/server/services/analytics.service";
import { goalsService } from "@/server/services/goals.service";
import { groupEngagementService } from "@/server/services/group-engagement.service";
import type { EngagementTier } from "@/server/services/group-engagement.service";

export const metadata: Metadata = {
  title: "Analytics",
};

export default async function AnalyticsPage() {
  const user = await requireAuthUser();

  const [momentum, categories, lifetime, achievements, allGoals, activityGrid, groupStats, groupNudges] =
    await Promise.all([
      analyticsService.getMomentumData(user.id, 30),
      analyticsService.getCategoryBreakdown(user.id),
      analyticsService.getLifetimeStats(user.id),
      achievementService.getAllWithStatus(user.id),
      goalsService.getAllForUser(user.id),
      analyticsService.getActivityGrid(user.id),
      groupEngagementService.getUserGroupAnalytics(user.id),
      groupEngagementService.getNudges(user.id),
    ]);

  const paceGoals: PaceGoal[] = allGoals
    .filter((g) => g.targetValue != null && g.endDate != null && !g.isCompleted)
    .map((g) => ({
      id: g.id,
      title: g.title,
      emoji: g.emoji,
      currentValue: g.currentValue,
      targetValue: g.targetValue!,
      unit: g.unit,
      startDate: g.startDate,
      endDate: g.endDate!,
    }));

  return (
    <AppLayout>
      <div className="space-y-5 animate-page-in">
        <div className="mb-2">
          <p className="section-label lg:desktop-kicker">Progress Visualized</p>
          <h1 className="mt-2 text-3xl font-serif text-ink sm:text-4xl lg:desktop-page-title">
            Analytics
          </h1>
          <p className="mt-1 font-serif italic text-ink-muted lg:mt-2" style={{ fontSize: "0.9375rem" }}>
            Patterns, pace, and proof of momentum.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { label: "Active Goals", value: categories.length, sub: "Tracking" },
            { label: "Avg Progress", value: `${Math.round(momentum.completionRate * 100)}%`, sub: "Across goals" },
            { label: "Day Streak", value: momentum.streakDays > 0 ? `${momentum.streakDays}` : "0", sub: "Consecutive" },
            { label: "Momentum", value: momentum.score, sub: "Score / 100", suffix: "/100" },
          ].map((stat) => (
            <div key={stat.label} className="panel-shell p-4 lg:p-5">
              <p className="section-label">{stat.label}</p>
              <div className="mt-2 font-serif font-semibold text-ink">
                <span className="text-2xl lg:text-3xl">{stat.value}</span>
                {stat.suffix && <span className="ml-1 text-sm text-ink-muted">{stat.suffix}</span>}
              </div>
              <p className="mt-0.5 text-xs text-ink-muted">{stat.sub}</p>
            </div>
          ))}
        </div>

        <div className="panel-shell p-5 lg:p-6">
          <p className="section-label mb-4">Life Balance</p>
          <LifeRadarChart categories={categories} />
        </div>

        <div className="panel-shell p-5 lg:p-6">
          <p className="section-label mb-4">7-Day Activity</p>
          <WeeklyBarChart data={momentum.weeklyActivity} />
        </div>

        <div className="panel-shell p-5 lg:p-6">
          <p className="section-label mb-4">52-Week Activity</p>
          <WeeklyHeatmap activityGrid={activityGrid} />
        </div>

        {categories.length > 0 && (
          <div className="panel-shell p-5 lg:p-6">
            <p className="section-label mb-4">Progress by Category</p>
            <CategoryBreakdown categories={categories} />
          </div>
        )}

        <div className="panel-shell p-5 lg:p-6">
          <p className="section-label mb-4">Achievements</p>
          <AchievementsGrid achievements={achievements} />
        </div>

        <div className="panel-shell p-5 lg:p-6">
          <p className="section-label mb-4">Lifetime Statistics</p>
          <LifetimeStats stats={lifetime} />
        </div>

        {/* Groups engagement section */}
        {groupStats.length > 0 && (
          <div className="panel-shell p-5 lg:p-6">
            <p className="section-label mb-4">Groups</p>

            {/* Nudges */}
            {groupNudges.length > 0 && (
              <div className="mb-5 space-y-2">
                {groupNudges.map((nudge, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
                  >
                    <span className="mt-0.5 text-amber-500">💬</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-amber-800">{nudge.groupName}</p>
                      <p className="mt-0.5 text-sm text-amber-700">{nudge.message}</p>
                    </div>
                    <a
                      href={`/groups/community/${nudge.groupId}`}
                      className="flex-shrink-0 rounded-lg bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200 transition-colors"
                    >
                      Go →
                    </a>
                  </div>
                ))}
              </div>
            )}

            {/* Per-group stats table */}
            <div className="divide-y divide-cream-dark">
              {groupStats.map((g) => {
                const tierColors: Record<EngagementTier, string> = {
                  Champion:  "text-gold",
                  Committed: "text-purple-600",
                  Active:    "text-sage-dark",
                  Newcomer:  "text-ink-muted",
                };
                return (
                  <div key={g.groupId} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <a
                        href={`/groups/community/${g.groupId}`}
                        className="font-semibold text-sm text-ink hover:underline truncate block"
                      >
                        {g.groupName}
                      </a>
                      <div className="mt-1 flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-ink-muted">
                          🎯 {g.goalsCompleted} goal{g.goalsCompleted !== 1 ? "s" : ""}
                        </span>
                        <span className="text-xs text-ink-muted">
                          💬 {g.commentsPosted} post{g.commentsPosted !== 1 ? "s" : ""}
                        </span>
                        <span className="text-xs text-ink-muted">
                          👏 {g.reactionsGiven} reaction{g.reactionsGiven !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold ${tierColors[g.tier]}`}>{g.tier}</p>
                      <p className="text-xs text-ink-muted">{g.engagementScore} pts</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {paceGoals.length > 0 && (
          <div className="panel-shell p-5 lg:p-6">
            <p className="section-label mb-4">Pace Tracker</p>
            <div className="divide-y divide-cream-dark">
              {paceGoals.map((goal) => (
                <div key={goal.id} className="py-4 first:pt-0 last:pb-0">
                  <PaceTracker goal={goal} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
