// src/app/onboarding/page.tsx
// Full-screen onboarding wizard. Redirects away if the user has already completed
// onboarding or already has goals.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/auth/helpers";
import { goalsService } from "@/server/services/goals.service";
import { OnboardingWizard } from "./onboarding-wizard";

export const metadata: Metadata = {
  title: "Welcome to North Star",
};

export default async function OnboardingPage() {
  const user = await requireAuthUser();

  // If onboarding is done or the user already has goals, send them to the dashboard.
  if (user.hasCompletedOnboarding) {
    redirect("/dashboard");
  }

  const goals = await goalsService.getAllForUser(user.id);
  if (goals.length > 0) {
    redirect("/dashboard");
  }

  return <OnboardingWizard userName={user.name ?? undefined} />;
}
