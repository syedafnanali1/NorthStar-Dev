// src/config/subscriptionConfig.ts
// Central subscription configuration. All plan definitions, limits, and pricing live here.
// ENFORCE_PAYMENTS controls whether feature gates are active.

// PAYMENT ENFORCEMENT — set to true when ready to require payment
export const ENFORCE_PAYMENTS = false;

// Trial length in days
export const TRIAL_DAYS = 7;

export type PlanId = "free" | "pro" | "teams" | "coaches" | "whitelabel";

export interface PlanLimits {
  maxGoals: number | null; // null = unlimited
  aiAccess: boolean;
  groupAccess: boolean;
  coachAccess: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  monthlyPrice?: number;
  annualPrice?: number;
  annualMonthlyEquivalent?: number;
  pricePerUser?: number;
  priceLabel?: string;
  features: string[];
  limits: PlanLimits;
  highlighted?: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "North Star Free",
    monthlyPrice: 0,
    features: [
      "Up to 3 goals",
      "Basic progress tracking",
      "No AI features",
      "No group or team features",
    ],
    limits: {
      maxGoals: 3,
      aiAccess: false,
      groupAccess: false,
      coachAccess: false,
    },
  },
  pro: {
    id: "pro",
    name: "North Star Pro",
    monthlyPrice: 9.99,
    annualPrice: 79,
    annualMonthlyEquivalent: 6.58,
    highlighted: true,
    features: [
      "Unlimited goals",
      "AI Coach access",
      "Progress analytics",
      "Priority support",
    ],
    limits: {
      maxGoals: null,
      aiAccess: true,
      groupAccess: false,
      coachAccess: false,
    },
  },
  teams: {
    id: "teams",
    name: "North Star Teams",
    pricePerUser: 14.99,
    features: [
      "Everything in Pro",
      "Team goal tracking",
      "Group accountability",
      "Team analytics dashboard",
      "Admin controls",
    ],
    limits: {
      maxGoals: null,
      aiAccess: true,
      groupAccess: true,
      coachAccess: false,
    },
  },
  coaches: {
    id: "coaches",
    name: "North Star Coaches",
    monthlyPrice: 49,
    features: [
      "Coach dashboard",
      "View all team member goals",
      "AI analysis of team performance",
      "Goal retention data and trends",
      "AI-generated professional coaching advice",
      "Export reports",
    ],
    limits: {
      maxGoals: null,
      aiAccess: true,
      groupAccess: true,
      coachAccess: true,
    },
  },
  whitelabel: {
    id: "whitelabel",
    name: "API / White Label",
    priceLabel: "Contact Us",
    features: [
      "Full API access",
      "White-label branding",
      "B2B wellness programs",
      "Custom integrations",
      "Dedicated support",
    ],
    limits: {
      maxGoals: null,
      aiAccess: true,
      groupAccess: true,
      coachAccess: true,
    },
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "pro", "teams", "coaches", "whitelabel"];
