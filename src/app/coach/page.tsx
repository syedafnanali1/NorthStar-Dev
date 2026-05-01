// src/app/coach/page.tsx
import type { Metadata } from "next";
import { requireAuthUser } from "@/lib/auth/helpers";
import { AppLayout } from "@/components/layout/app-layout";
import { CoachDashboard } from "./coach-dashboard";
import { subscriptionsService } from "@/server/services/subscriptions.service";

export const metadata: Metadata = { title: "Coach Dashboard — NorthStar" };

export default async function CoachPage() {
  const user = await requireAuthUser();

  let plan: string | null = "free";
  try {
    const sub = await subscriptionsService.getForUser(user.id);
    plan = sub.plan;
  } catch {
    plan = "free";
  }

  // Placeholder team data — replace with real DB queries when teams are wired up
  const teamMembers: {
    id: string;
    name: string | null;
    image: string | null;
    activeGoals: number;
    completedGoals: number;
    completionRate: number;
  }[] = [];

  const teamStats = {
    totalGoals: 0,
    completedGoals: 0,
    retentionRate: 0,
    avgGoalsPerUser: 0,
  };

  return (
    <AppLayout>
      <CoachDashboard
        user={{
          trialStartDate: user.trialStartDate ?? null,
          isDemo: user.isDemo ?? false,
          plan,
        }}
        teamMembers={teamMembers}
        teamStats={teamStats}
      />
    </AppLayout>
  );
}
