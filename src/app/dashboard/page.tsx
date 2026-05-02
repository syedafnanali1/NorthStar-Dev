// src/app/dashboard/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/auth/helpers";
import { AppLayout } from "@/components/layout/app-layout";
import { goalsService } from "@/server/services/goals.service";
import { analyticsService } from "@/server/services/analytics.service";
import { MomentumCard } from "@/components/goals/momentum-card";
import { GoalList } from "./goal-list";
import { AiInsightBanner } from "./ai-insight-banner";
import Link from "next/link";
import { MobileSidecarServer } from "@/components/dashboard/mobile-sidecar-server";
import { aiCoachService } from "@/server/services/ai-coach.service";
import { CompoundViewButton } from "./compound-view-button";
import { db } from "@/lib/db";
import { circleConnections, users } from "@/drizzle/schema";
import { and, eq, inArray } from "drizzle-orm";
import { TrialBanner } from "@/components/ui/trial-banner";
import { StatsGlanceCards } from "@/components/analytics/stats-glance-cards";
import { CrossTabNudge } from "@/components/ui/cross-tab-nudge";
import { DailyPulseCard } from "./daily-pulse-card";

export const metadata: Metadata = {
  title: "Your Goals",
};

export default async function DashboardPage() {
  const user = await requireAuthUser();

  let goals: Awaited<ReturnType<typeof goalsService.getAllForUser>> = [];
  let momentum: Awaited<ReturnType<typeof analyticsService.getMomentumData>> | null = null;
  let latestInsight: Awaited<ReturnType<typeof aiCoachService.getLatestUnread>> = null;

  try {
    [goals, momentum, latestInsight] = await Promise.all([
      goalsService.getAllForUser(user.id),
      analyticsService.getMomentumData(user.id, 30),
      user.aiCoachingEnabled
        ? aiCoachService.getLatestUnread(user.id)
        : Promise.resolve(null),
    ]);
  } catch (err) {
    console.error("[DashboardPage] data fetch error", err);
    // Partial failure: continue with empty defaults so the page still renders
  }

  if (!user.hasCompletedOnboarding && goals.length === 0) {
    redirect("/onboarding");
  }

  // Fetch circle members so GoalCards can power the "Add to Circle" share modal
  let circleMembers: { id: string; name: string | null; image: string | null; streak: number }[] = [];
  try {
    const [incoming, outgoing] = await Promise.all([
      db
        .select({ otherId: circleConnections.requesterId })
        .from(circleConnections)
        .where(and(eq(circleConnections.receiverId, user.id), eq(circleConnections.status, "accepted"))),
      db
        .select({ otherId: circleConnections.receiverId })
        .from(circleConnections)
        .where(and(eq(circleConnections.requesterId, user.id), eq(circleConnections.status, "accepted"))),
    ]);

    const connectionIds = [
      ...incoming.map((c) => c.otherId),
      ...outgoing.map((c) => c.otherId),
    ];

    circleMembers = connectionIds.length > 0
      ? await db
          .select({ id: users.id, name: users.name, image: users.image, streak: users.currentStreak })
          .from(users)
          .where(inArray(users.id, connectionIds))
      : [];
  } catch (err) {
    console.error("[DashboardPage] circle fetch error", err);
  }

  const firstName = user.name?.split(" ")[0];

  return (
    <AppLayout>
      <div className="space-y-5 animate-page-in">
        {/* ── Trial Banner ─────────────────────────────────────── */}
        <TrialBanner user={{ trialStartDate: user.trialStartDate, isDemo: user.isDemo }} />

        {/* ── Page Header ─────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-label lg:desktop-kicker">Your Goals</p>
            <h1 className="mt-1.5 font-serif text-2xl text-ink sm:text-3xl lg:desktop-page-title">
              {firstName ? `${firstName}'s` : "Your"} North Stars
            </h1>
            <p className="mt-1 hidden sm:block font-serif italic text-ink-muted lg:mt-2" style={{ fontSize: "0.9375rem" }}>
              Keep the next promise visible. Small actions, extraordinary results.
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2 pt-0.5">
            <div className="hidden lg:block">
              <CompoundViewButton />
            </div>
            <Link
              href="/goals/new"
              className="btn-gold flex-shrink-0 rounded-full px-4 text-sm h-9 lg:h-10 lg:px-5 flex items-center gap-1.5"
            >
              <span className="text-base leading-none">+</span>
              <span className="hidden sm:inline">New Goal</span>
              <span className="sm:hidden">New</span>
            </Link>
          </div>
        </div>

        {/* ── Glance Stats ──────────────────────────────────────── */}
        <StatsGlanceCards />

        {/* ── Daily Pulse ───────────────────────────────────────── */}
        <DailyPulseCard />

        {/* ── Momentum ──────────────────────────────────────────── */}
        {momentum ? <MomentumCard momentum={momentum} /> : null}

        {/* ── AI Coaching Banner ────────────────────────────────── */}
        {latestInsight ? (
          <AiInsightBanner insight={latestInsight} />
        ) : null}

        <GoalList goals={goals} circleMembers={circleMembers} />
        <MobileSidecarServer userId={user.id} />

        {/* ── Cross-tab nudge (frequency-capped, 1/session) ─────── */}
        <CrossTabNudge
          variant={goals.length === 0 ? "post_goal_create" : "post_checkin"}
          autoShow={goals.length > 0}
          delayMs={5000}
        />
      </div>
    </AppLayout>
  );
}
