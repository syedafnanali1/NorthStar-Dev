"use client";

// src/components/ui/trial-banner.tsx
// Non-intrusive trial countdown banner shown on the dashboard.
// Only visible when ENFORCE_PAYMENTS is true and trial has <= 3 days left.

import Link from "next/link";
import { X } from "lucide-react";
import { useState } from "react";
import { ENFORCE_PAYMENTS } from "@/config/subscriptionConfig";
import { trialDaysRemaining, type SubscriptionUser } from "@/utils/subscriptionUtils";

interface TrialBannerProps {
  user: SubscriptionUser;
}

export function TrialBanner({ user }: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!ENFORCE_PAYMENTS || dismissed || user.isDemo) return null;

  const daysLeft = trialDaysRemaining(user);
  if (daysLeft <= 0 || daysLeft > 3) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3">
      <p className="text-sm text-ink">
        🎉 <span className="font-semibold">Free Trial</span> — {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining.{" "}
        <Link href="/premium" className="text-gold underline underline-offset-2 hover:opacity-80">
          Upgrade to keep access.
        </Link>
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-ink/5"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
