export const runtime = "edge";

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { analyticsService } from "@/server/services/analytics.service";
import { goalsService } from "@/server/services/goals.service";
import { db } from "@/lib/db";
import { goals, goalIntentions } from "@/drizzle/schema";
import { and, eq, lt, sql } from "drizzle-orm";

export interface RankedInsight {
  id: string;
  type: "at_risk" | "streak_risk" | "momentum_spike" | "intention_gap" | "completion_close" | "nudge";
  priority: number; // 1–10, higher = more urgent
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  goalId?: string;
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [momentum, userGoals] = await Promise.all([
    analyticsService.getMomentumData(userId, 30),
    goalsService.getAllForUser(userId),
  ]);

  const insights: RankedInsight[] = [];
  const now = Date.now();

  // ── 1. At-risk goals: low progress + deadline approaching ─────────────────
  for (const goal of userGoals) {
    if (!goal.endDate || goal.completedAt) continue;
    const daysLeft = Math.ceil((new Date(goal.endDate).getTime() - now) / 86_400_000);
    const pct = goal.percentComplete ?? 0;

    if (daysLeft <= 14 && pct < 40) {
      insights.push({
        id: `at_risk_${goal.id}`,
        type: "at_risk",
        priority: 10 - Math.max(0, daysLeft - 1),
        title: `"${goal.title}" is at risk`,
        body: `${daysLeft} day${daysLeft === 1 ? "" : "s"} left and only ${Math.round(pct)}% complete. A daily habit will get you there.`,
        ctaLabel: "Log progress",
        ctaHref: `/goals/${goal.id}`,
        goalId: goal.id,
      });
    }

    // Completion close
    if (pct >= 80 && !goal.completedAt) {
      insights.push({
        id: `completion_close_${goal.id}`,
        type: "completion_close",
        priority: 7,
        title: `Almost there on "${goal.title}"`,
        body: `You're ${Math.round(pct)}% done. One final push and this goal is yours.`,
        ctaLabel: "Finish strong",
        ctaHref: `/goals/${goal.id}`,
        goalId: goal.id,
      });
    }
  }

  // ── 2. Streak risk ────────────────────────────────────────────────────────
  if (momentum.streakDays >= 3 && momentum.completionRate < 0.3) {
    insights.push({
      id: "streak_risk",
      type: "streak_risk",
      priority: 8,
      title: `Protect your ${momentum.streakDays}-day streak`,
      body: "Your check-in rate dipped this week. Log one task today to keep the streak alive.",
      ctaLabel: "Log now",
      ctaHref: "/calendar",
    });
  }

  // ── 3. Intention gaps (goals with no intentions set) ─────────────────────
  const goalsWithIntentions = await db
    .select({ goalId: goalIntentions.goalId })
    .from(goalIntentions)
    .where(
      sql`${goalIntentions.goalId} IN (${sql.join(
        userGoals.filter((g) => !g.completedAt).map((g) => sql`${g.id}`),
        sql`, `
      )})`
    );

  const coveredGoalIds = new Set(goalsWithIntentions.map((r) => r.goalId));
  const uncoveredGoals = userGoals.filter((g) => !g.completedAt && !coveredGoalIds.has(g.id));

  if (uncoveredGoals.length > 0) {
    const g = uncoveredGoals[0]!;
    insights.push({
      id: `intention_gap_${g.id}`,
      type: "intention_gap",
      priority: 5,
      title: `Add an intention to "${g.title}"`,
      body: "Goals with scheduled intentions are 3× more likely to be completed. Add a time to work on this.",
      ctaLabel: "Add intention",
      ctaHref: `/goals/${g.id}`,
      goalId: g.id,
    });
  }

  // ── 4. Momentum spike / encouragement ────────────────────────────────────
  if (momentum.weeklyDelta > 15) {
    insights.push({
      id: "momentum_spike",
      type: "momentum_spike",
      priority: 4,
      title: "You're on a roll 🔥",
      body: `Your momentum is up ${Math.round(momentum.weeklyDelta)}% this week. Keep the energy going.`,
      ctaLabel: "View analytics",
      ctaHref: "/analytics",
    });
  }

  // ── 5. No active goals ────────────────────────────────────────────────────
  if (userGoals.length === 0) {
    insights.push({
      id: "no_goals",
      type: "nudge",
      priority: 9,
      title: "Set your first goal",
      body: "You have no active goals. Define what you're working toward and start tracking progress.",
      ctaLabel: "Create goal",
      ctaHref: "/goals/new",
    });
  }

  // Sort by priority descending, cap at 5
  const ranked = insights.sort((a, b) => b.priority - a.priority).slice(0, 5);

  return NextResponse.json({ insights: ranked, generatedAt: new Date().toISOString() });
}
