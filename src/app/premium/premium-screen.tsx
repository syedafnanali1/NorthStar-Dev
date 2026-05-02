"use client";

// src/app/premium/premium-screen.tsx
// Full plan selection UI. Displays all 5 plans with feature lists and upgrade CTAs.
// Payment provider is not yet integrated — handleUpgrade logs intent and shows a toast.

import { useState } from "react";
import { Check, FlaskConical, Loader2, Mail, Star, Users, Zap } from "lucide-react";
import { PLAN_ORDER, PLANS, TRIAL_DAYS, type PlanId } from "@/config/subscriptionConfig";
import { trialDaysRemaining, type SubscriptionUser } from "@/utils/subscriptionUtils";

interface PremiumScreenProps {
  user: SubscriptionUser & { plan?: string | null };
}

function handleUpgrade(planId: PlanId) {
  // TODO: wire up to Stripe / RevenueCat when payment provider is configured
  console.info("[upgrade] intent", planId);
  alert(`Upgrade to ${PLANS[planId].name} — payment integration coming soon.`);
}

function TestActivateProButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function activate() {
    setStatus("loading");
    try {
      const res = await fetch("/api/billing/subscription", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro", status: "active" }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("done");
      setTimeout(() => window.location.reload(), 800);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={activate}
      disabled={status === "loading" || status === "done"}
      className="flex items-center gap-2 rounded-xl border border-dashed border-ink/20 bg-cream px-4 py-2.5 text-sm font-medium text-ink-muted transition hover:border-ink/40 hover:text-ink disabled:opacity-50"
    >
      {status === "loading" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FlaskConical className="h-4 w-4" />
      )}
      {status === "done"
        ? "Pro activated — reloading…"
        : status === "error"
        ? "Error — try again"
        : "Test: Activate Pro"}
    </button>
  );
}

const PLAN_ICONS: Record<PlanId, React.ReactNode> = {
  free: <span className="text-xl">🆓</span>,
  pro: <Star className="h-5 w-5 text-gold fill-gold" />,
  teams: <Users className="h-5 w-5 text-sky-400" />,
  coaches: <Zap className="h-5 w-5 text-violet-400" />,
  whitelabel: <Mail className="h-5 w-5 text-sage" />,
};

export function PremiumScreen({ user }: PremiumScreenProps) {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const daysLeft = trialDaysRemaining(user);
  const currentPlan = (user?.plan as PlanId | null) ?? "free";

  return (
    <div className="space-y-8 animate-page-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <p className="section-label">Pricing</p>
        <h1 className="font-serif text-3xl text-ink sm:text-4xl">Choose Your Plan</h1>
        <p className="text-ink-muted">Start free. Upgrade when you&apos;re ready.</p>
        {daysLeft > 0 && (
          <div className="inline-block rounded-full bg-gold/15 px-4 py-1.5 text-sm font-medium text-gold">
            Your free trial ends in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Monthly / Annual Toggle (shown for Pro) */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setBilling("monthly")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
            billing === "monthly"
              ? "bg-ink text-cream-paper"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setBilling("annual")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
            billing === "annual"
              ? "bg-ink text-cream-paper"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          Annual
          <span className="ml-1.5 rounded-full bg-gold/20 px-1.5 py-0.5 text-xs text-gold">
            Save 34%
          </span>
        </button>
      </div>

      {/* Plan Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {PLAN_ORDER.map((planId) => {
          const plan = PLANS[planId];
          const isCurrent = currentPlan === planId;
          const isHighlighted = plan.highlighted;

          let priceDisplay: React.ReactNode = null;
          if (planId === "free") {
            priceDisplay = <span className="text-3xl font-bold text-ink">Free</span>;
          } else if (planId === "pro") {
            const price =
              billing === "annual" ? plan.annualMonthlyEquivalent : plan.monthlyPrice;
            priceDisplay = (
              <div>
                <span className="text-3xl font-bold text-ink">${price?.toFixed(2)}</span>
                <span className="text-ink-muted">/mo</span>
                {billing === "annual" && (
                  <p className="mt-0.5 text-xs text-gold">
                    Billed ${plan.annualPrice}/yr — save ${((plan.monthlyPrice! * 12) - plan.annualPrice!).toFixed(0)}
                  </p>
                )}
              </div>
            );
          } else if (planId === "teams") {
            priceDisplay = (
              <div>
                <span className="text-3xl font-bold text-ink">${plan.pricePerUser}</span>
                <span className="text-ink-muted">/mo per user</span>
              </div>
            );
          } else if (planId === "coaches") {
            priceDisplay = (
              <div>
                <span className="text-3xl font-bold text-ink">${plan.monthlyPrice}</span>
                <span className="text-ink-muted">/mo</span>
              </div>
            );
          } else {
            priceDisplay = (
              <span className="text-2xl font-bold text-ink">{plan.priceLabel}</span>
            );
          }

          return (
            <div
              key={planId}
              className={`relative flex flex-col rounded-2xl border p-6 transition-all ${
                isHighlighted
                  ? "border-gold/50 bg-gold/5 shadow-gold"
                  : "border-cream-dark bg-cream-paper"
              }`}
            >
              {isHighlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-3 py-0.5 text-xs font-bold text-ink">
                  Most Popular
                </span>
              )}

              {/* Plan header */}
              <div className="flex items-center gap-2 mb-4">
                {PLAN_ICONS[planId]}
                <h2 className="font-semibold text-ink">{plan.name}</h2>
              </div>

              {/* Price */}
              <div className="mb-5">{priceDisplay}</div>

              {/* Features */}
              <ul className="flex-1 space-y-2 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-ink-muted">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {planId === "whitelabel" ? (
                <a
                  href="mailto:hello@northstar.app?subject=API%20/%20White%20Label%20Inquiry"
                  className="flex items-center justify-center gap-2 rounded-xl border border-ink/20 px-4 py-2.5 text-sm font-semibold text-ink transition-all hover:bg-ink hover:text-cream-paper"
                >
                  Contact Sales
                </a>
              ) : isCurrent ? (
                <button
                  type="button"
                  disabled
                  className="flex items-center justify-center gap-2 rounded-xl bg-cream px-4 py-2.5 text-sm font-semibold text-ink-muted cursor-default"
                >
                  Current Plan
                </button>
              ) : planId === "free" ? (
                <button
                  type="button"
                  onClick={() => handleUpgrade("free")}
                  className="flex items-center justify-center gap-2 rounded-xl border border-ink/20 px-4 py-2.5 text-sm font-semibold text-ink transition-all hover:bg-cream"
                >
                  Downgrade to Free
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleUpgrade(planId)}
                  className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-90 ${
                    isHighlighted
                      ? "bg-gold text-ink"
                      : "bg-ink text-cream-paper"
                  }`}
                >
                  {planId === "pro"
                    ? "Upgrade to Pro"
                    : planId === "teams"
                    ? "Start Team Plan"
                    : "Get Coach Access"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-center space-y-1 text-sm text-ink-muted pb-4">
        <p>All plans include a {TRIAL_DAYS}-day free trial for new users.</p>
        <p>Cancel anytime. No hidden fees.</p>
        <button
          type="button"
          className="mt-2 text-xs underline underline-offset-2 hover:text-ink"
          onClick={() => alert("Restore purchases — payment integration coming soon.")}
        >
          Restore Purchases
        </button>
      </div>

      {/* Dev test mode */}
      <div className="border-t border-cream-dark pt-4 flex flex-col items-center gap-2">
        <p className="text-xs text-ink-muted/60">Developer testing</p>
        <TestActivateProButton />
      </div>
    </div>
  );
}
