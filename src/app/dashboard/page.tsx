// src/app/dashboard/page.tsx
import type { Metadata } from "next";
import { requireAuthUser } from "@/lib/auth/helpers";
import { AppLayout } from "@/components/layout/app-layout";
import { goalsService } from "@/server/services/goals.service";
import { analyticsService } from "@/server/services/analytics.service";
import { MomentumCard } from "@/components/goals/momentum-card";
import { GoalCard } from "@/components/goals/goal-card";
import { EmptyGoals } from "@/components/goals/empty-goals";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Your Goals",
};

export default async function DashboardPage() {
  const user = await requireAuthUser();

  const [goals, momentum] = await Promise.all([
    goalsService.getAllForUser(user.id),
    analyticsService.getMomentumData(user.id, 30),
  ]);

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs text-ink-muted uppercase tracking-widest font-medium mb-1">
            Welcome back
          </p>
          <h1 className="text-3xl font-serif text-ink">
            {user.name ? `${user.name.split(" ")[0]}'s` : "Your"} North Stars
          </h1>
        </div>
        <Link
          href="/goals/new"
          className="btn-primary flex items-center gap-2"
        >
          <span>+</span>
          New Goal
        </Link>
      </div>

      {/* Momentum Card */}
      <MomentumCard momentum={momentum} className="mb-8" />

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <EmptyGoals />
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-muted">
            Active Goals
          </h2>
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      )}
    </AppLayout>
  );
}
