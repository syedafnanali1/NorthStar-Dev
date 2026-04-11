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

export const metadata: Metadata = {
  title: "Your Goals",
};

export default async function DashboardPage() {
  const user = await requireAuthUser();

  const [goals, momentum, latestInsight] = await Promise.all([
    goalsService.getAllForUser(user.id),
    analyticsService.getMomentumData(user.id, 30),
    user.aiCoachingEnabled
      ? aiCoachService.getLatestUnread(user.id)
      : Promise.resolve(null),
  ]);

  if (!user.hasCompletedOnboarding && goals.length === 0) {
    redirect("/onboarding");
  }

  const firstName = user.name?.split(" ")[0];

  return (
    <AppLayout>
      <div className="space-y-5 animate-page-in">
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

        {/* â”€â”€ AI Coaching Banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {latestInsight ? (
          <AiInsightBanner insight={latestInsight} />
        ) : null}

        <MomentumCard momentum={momentum} />
        <GoalList goals={goals} />
        <MobileSidecarServer userId={user.id} />
      </div>
    </AppLayout>
  );
}
