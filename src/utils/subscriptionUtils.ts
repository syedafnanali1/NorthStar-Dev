// src/utils/subscriptionUtils.ts
// Trial and subscription utility helpers.
// When ENFORCE_PAYMENTS is false, all users get full Pro-level access.

import { ENFORCE_PAYMENTS, PLANS, TRIAL_DAYS, type PlanId } from "@/config/subscriptionConfig";

export interface SubscriptionUser {
  trialStartDate?: Date | string | null;
  plan?: string | null;
  isDemo?: boolean;
}

export function isTrialActive(user: SubscriptionUser | null | undefined): boolean {
  if (!ENFORCE_PAYMENTS) return true;
  if (!user?.trialStartDate) return false;
  const start = new Date(user.trialStartDate);
  const diffDays = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= TRIAL_DAYS;
}

export function trialDaysRemaining(user: SubscriptionUser | null | undefined): number {
  if (!user?.trialStartDate) return 0;
  const start = new Date(user.trialStartDate);
  const diffDays = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(TRIAL_DAYS - diffDays));
}

export function getUserPlan(user: SubscriptionUser | null | undefined): PlanId {
  if (!ENFORCE_PAYMENTS) return "pro";
  if (isTrialActive(user)) return "pro"; // Trial users get Pro features
  const plan = user?.plan;
  if (plan && plan in PLANS) return plan as PlanId;
  return "free";
}

export type FeatureKey = "aiAccess" | "groupAccess" | "coachAccess" | "unlimitedGoals";

export function canAccessFeature(
  user: SubscriptionUser | null | undefined,
  feature: FeatureKey
): boolean {
  if (!ENFORCE_PAYMENTS) return true;
  const planId = getUserPlan(user);
  const plan = PLANS[planId];
  if (!plan) return false;

  switch (feature) {
    case "aiAccess":
      return plan.limits.aiAccess;
    case "groupAccess":
      return plan.limits.groupAccess;
    case "coachAccess":
      return plan.limits.coachAccess;
    case "unlimitedGoals":
      return plan.limits.maxGoals === null;
    default:
      return false;
  }
}

export function getGoalLimit(user: SubscriptionUser | null | undefined): number | null {
  if (!ENFORCE_PAYMENTS) return null;
  const planId = getUserPlan(user);
  return PLANS[planId]?.limits.maxGoals ?? 3;
}

export function isCoachPlan(user: SubscriptionUser | null | undefined): boolean {
  if (!ENFORCE_PAYMENTS) return true;
  const planId = getUserPlan(user);
  return planId === "coaches" || planId === "whitelabel";
}

export function shouldShowUpgradeBanner(user: SubscriptionUser | null | undefined): boolean {
  if (!ENFORCE_PAYMENTS) return false;
  if (user?.isDemo) return false;
  return isTrialActive(user) && trialDaysRemaining(user) <= 3;
}
