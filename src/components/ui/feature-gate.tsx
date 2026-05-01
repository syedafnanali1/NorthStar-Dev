"use client";

// src/components/ui/feature-gate.tsx
// Wraps any premium feature. If the user lacks access, renders a locked upgrade card.
// When ENFORCE_PAYMENTS is false, always renders children with no blocking.

import Link from "next/link";
import { Lock } from "lucide-react";
import { ENFORCE_PAYMENTS, PLANS, type PlanId } from "@/config/subscriptionConfig";
import { canAccessFeature, type FeatureKey, type SubscriptionUser } from "@/utils/subscriptionUtils";

interface FeatureGateProps {
  feature: FeatureKey;
  plan: PlanId;
  user?: SubscriptionUser | null;
  children: React.ReactNode;
  featureLabel?: string;
}

export function FeatureGate({ feature, plan, user, children, featureLabel }: FeatureGateProps) {
  if (!ENFORCE_PAYMENTS || canAccessFeature(user, feature)) {
    return <>{children}</>;
  }

  const planName = PLANS[plan]?.name ?? "a paid plan";
  const planPrice =
    plan === "pro"
      ? "$9.99/mo"
      : plan === "teams"
      ? "$14.99/mo per user"
      : plan === "coaches"
      ? "$49/mo"
      : null;

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-gold/20 bg-gold/5 px-6 py-8 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15">
        <Lock className="h-5 w-5 text-gold" />
      </span>
      <div>
        <p className="font-semibold text-ink">
          {featureLabel ?? "This feature"} requires {planName}
        </p>
        {planPrice ? (
          <p className="mt-0.5 text-sm text-ink-muted">{planPrice}</p>
        ) : null}
      </div>
      <Link
        href="/premium"
        className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
      >
        Upgrade
      </Link>
    </div>
  );
}
