// src/app/onboarding/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/auth/helpers";
import { goalsService } from "@/server/services/goals.service";
import { subscriptionsService } from "@/server/services/subscriptions.service";
import { OnboardingWizard } from "./onboarding-wizard";

export const metadata: Metadata = {
  title: "Welcome to North Star",
};

export default async function OnboardingPage() {
  const user = await requireAuthUser();

  if (user.hasCompletedOnboarding) {
    redirect("/dashboard");
  }

  const goals = await goalsService.getAllForUser(user.id);
  if (goals.length > 0) {
    redirect("/dashboard");
  }

  // Check actual DB subscription — not the global ENFORCE_PAYMENTS flag —
  // so the AI gate reflects the user's real plan in the wizard.
  let hasPremiumAI = false;
  try {
    hasPremiumAI = await subscriptionsService.isPro(user.id);
  } catch {
    // Non-fatal — gate stays closed on error
  }

  return <OnboardingWizard userName={user.name ?? undefined} hasPremiumAI={hasPremiumAI} />;
}
