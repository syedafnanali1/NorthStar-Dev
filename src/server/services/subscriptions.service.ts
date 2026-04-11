import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSubscriptions } from "@/drizzle/schema";

export type SubscriptionPlan = "free" | "pro" | "team";
export type SubscriptionStatus = "active" | "trialing" | "canceled" | "past_due";

export const subscriptionsService = {
  async getForUser(userId: string) {
    const [row] = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);

    return (
      row ?? {
        id: `virtual_free_${userId}`,
        userId,
        plan: "free",
        status: "active",
        priceCents: 0,
        renewsAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    );
  },

  async setPlan(input: {
    userId: string;
    plan: SubscriptionPlan;
    status?: SubscriptionStatus;
    renewsAt?: Date | null;
  }) {
    const priceCents =
      input.plan === "pro" ? 999 : input.plan === "team" ? 1499 : 0;
    const [saved] = await db
      .insert(userSubscriptions)
      .values({
        userId: input.userId,
        plan: input.plan,
        status: input.status ?? "active",
        priceCents,
        renewsAt: input.renewsAt ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userSubscriptions.userId,
        set: {
          plan: input.plan,
          status: input.status ?? "active",
          priceCents,
          renewsAt: input.renewsAt ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!saved) throw new Error("Failed to update subscription");
    return saved;
  },

  async isPro(userId: string): Promise<boolean> {
    const [sub] = await db
      .select({ plan: userSubscriptions.plan, status: userSubscriptions.status })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);

    if (!sub) return false;
    return (
      (sub.plan === "pro" || sub.plan === "team") &&
      (sub.status === "active" || sub.status === "trialing")
    );
  },

  async getGoalLimit(userId: string): Promise<number | null> {
    const pro = await this.isPro(userId);
    return pro ? null : 3;
  },

  async hasActiveTeamPlan(userId: string): Promise<boolean> {
    const [sub] = await db
      .select({ id: userSubscriptions.id })
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.userId, userId),
          eq(userSubscriptions.plan, "team"),
          eq(userSubscriptions.status, "active")
        )
      )
      .limit(1);
    return Boolean(sub);
  },
};

