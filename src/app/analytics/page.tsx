// src/app/analytics/page.tsx
import type { Metadata } from "next";
import { requireAuthUser } from "@/lib/auth/helpers";
import { AppLayout } from "@/components/layout/app-layout";
import { analyticsService } from "@/server/services/analytics.service";
import { achievementService } from "@/server/services/achievements.service";
import { WeeklyBarChart } from "@/components/analytics/weekly-bar-chart";
import { CategoryBreakdown } from "@/components/analytics/category-breakdown";
import { AchievementsGrid } from "@/components/analytics/achievements-grid";
import { LifetimeStats } from "@/components/analytics/lifetime-stats";

export const metadata: Metadata = {
  title: "Analytics",
};

export default async function AnalyticsPage() {
  const user = await requireAuthUser();

  const [momentum, categories, lifetime, achievements] = await Promise.all([
    analyticsService.getMomentumData(user.id, 30),
    analyticsService.getCategoryBreakdown(user.id),
    analyticsService.getLifetimeStats(user.id),
    achievementService.getAllWithStatus(user.id),
  ]);

  return (
    <AppLayout>
      <div className="mb-8">
        <p className="text-2xs uppercase tracking-widest text-ink-muted mb-1">
          Your Progress
        </p>
        <h1 className="text-3xl font-serif text-ink">Analytics</h1>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card p-5">
          <div className="text-3xl font-serif font-semibold text-ink">
            {momentum.score}
          </div>
          <div className="text-2xs uppercase tracking-widest text-ink-muted mt-1">
            Momentum
          </div>
          <div className="h-1 bg-cream-dark rounded-full mt-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-gold transition-all"
              style={{ width: `${momentum.score}%` }}
            />
          </div>
        </div>

        <div className="card p-5">
          <div className="text-3xl font-serif font-semibold text-ink">
            🔥 {momentum.streakDays}
          </div>
          <div className="text-2xs uppercase tracking-widest text-ink-muted mt-1">
            Current Streak
          </div>
          <div className="text-xs text-ink-muted mt-2">
            Best: {momentum.longestStreak} days
          </div>
        </div>

        <div className="card p-5">
          <div className="text-3xl font-serif font-semibold text-ink">
            {Math.round(momentum.completionRate * 100)}%
          </div>
          <div className="text-2xs uppercase tracking-widest text-ink-muted mt-1">
            Completion Rate
          </div>
          <div className="text-xs text-ink-muted mt-2">7-day average</div>
        </div>
      </div>

      {/* Weekly Activity Chart */}
      <div className="card p-6 mb-6">
        <h2 className="text-xs uppercase tracking-widest text-ink-muted font-semibold mb-5">
          7-Day Activity — Tasks Completed
        </h2>
        <WeeklyBarChart data={momentum.weeklyActivity} />
      </div>

      {/* Category Breakdown */}
      {categories.length > 0 && (
        <div className="card p-6 mb-6">
          <h2 className="text-xs uppercase tracking-widest text-ink-muted font-semibold mb-5">
            Progress by Category
          </h2>
          <CategoryBreakdown categories={categories} />
        </div>
      )}

      {/* Achievements */}
      <div className="card p-6 mb-6">
        <h2 className="text-xs uppercase tracking-widest text-ink-muted font-semibold mb-5">
          🏆 Achievements
        </h2>
        <AchievementsGrid achievements={achievements} />
      </div>

      {/* Lifetime Stats */}
      <div className="card p-6">
        <h2 className="text-xs uppercase tracking-widest text-ink-muted font-semibold mb-5">
          Lifetime Statistics
        </h2>
        <LifetimeStats stats={lifetime} />
      </div>
    </AppLayout>
  );
}
