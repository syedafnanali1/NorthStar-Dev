// src/app/premium/page.tsx
import type { Metadata } from "next";
import { requireAuthUser } from "@/lib/auth/helpers";
import { AppLayout } from "@/components/layout/app-layout";
import { PremiumScreen } from "./premium-screen";
import { subscriptionsService } from "@/server/services/subscriptions.service";

export const metadata: Metadata = { title: "Upgrade — NorthStar" };

export default async function PremiumPage() {
  const user = await requireAuthUser();

  let plan: string | null = null;
  try {
    const sub = await subscriptionsService.getForUser(user.id);
    plan = sub.plan;
  } catch {
    // Subscription table may not exist yet — default to free
    plan = "free";
  }

  return (
    <AppLayout contentClassName="max-w-3xl">
      <PremiumScreen
        user={{
          trialStartDate: user.trialStartDate ?? null,
          isDemo: user.isDemo ?? false,
          plan,
        }}
      />
    </AppLayout>
  );
}
