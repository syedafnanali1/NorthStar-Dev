import { addDays } from "date-fns";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import {
  subscriptionsService,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from "@/server/services/subscriptions.service";
import type { NextRequest } from "next/server";

const updateSchema = z.object({
  plan: z.enum(["free", "pro", "team"]),
  status: z.enum(["active", "trialing", "canceled", "past_due"]).optional(),
});

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [subscription, goalLimit] = await Promise.all([
    subscriptionsService.getForUser(userId),
    subscriptionsService.getGoalLimit(userId),
  ]);

  return NextResponse.json({
    subscription,
    entitlements: {
      maxActiveGoals: goalLimit,
      aiCoaching: subscription.plan !== "free",
      weeklyHeatmap52: subscription.plan !== "free",
      advancedAnalytics: subscription.plan !== "free",
    },
  });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as unknown;
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const renewsAt =
    parsed.data.plan === "free" ? null : addDays(new Date(), 30);
  const subscription = await subscriptionsService.setPlan({
    userId,
    plan: parsed.data.plan as SubscriptionPlan,
    status: (parsed.data.status ?? "active") as SubscriptionStatus,
    renewsAt,
  });

  return NextResponse.json({ subscription });
}

