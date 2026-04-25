import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSubscriptions } from "@/drizzle/schema";

export type SubscriptionPlan = "free" | "pro" | "team";
export type SubscriptionStatus = "active" | "trialing" | "canceled" | "past_due";

let warnedMissingSubscriptionsTable = false;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  if (!("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function getErrorCause(error: unknown): unknown {
  if (!error || typeof error !== "object") return undefined;
  return "cause" in error ? (error as { cause?: unknown }).cause : undefined;
}

function isMissingSubscriptionsTableError(error: unknown): boolean {
  if (!error) return false;
  if (getErrorCode(error) === "42P01") return true;

  const message = getErrorMessage(error);
  if (/relation\s+"?user_subscriptions"?\s+does not exist/i.test(message)) {
    return true;
  }

  const cause = getErrorCause(error);
  if (cause) {
    return isMissingSubscriptionsTableError(cause);
  }

  return false;
}

function logMissingSubscriptionsTable(error: unknown): void {
  if (warnedMissingSubscriptionsTable) return;
  warnedMissingSubscriptionsTable = true;
  console.warn(
    "[subscriptions] user_subscriptions table is missing. Falling back to free-plan defaults. Run `npm run db:push` to sync schema.",
    getErrorMessage(error)
  );
}

function buildVirtualFreeSubscription(userId: string) {
  return {
    id: `virtual_free_${userId}`,
    userId,
    plan: "free" as const,
    status: "active" as const,
    priceCents: 0,
    renewsAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export const subscriptionsService = {
  async getForUser(userId: string) {
    let row:
      | {
          id: string;
          userId: string;
          plan: string;
          status: string;
          priceCents: number;
          renewsAt: Date | null;
          createdAt: Date;
          updatedAt: Date;
        }
      | undefined;
    try {
      [row] = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, userId))
        .limit(1);
    } catch (error) {
      if (!isMissingSubscriptionsTableError(error)) {
        throw error;
      }
      logMissingSubscriptionsTable(error);
      return buildVirtualFreeSubscription(userId);
    }

    return row ?? buildVirtualFreeSubscription(userId);
  },

  async setPlan(input: {
    userId: string;
    plan: SubscriptionPlan;
    status?: SubscriptionStatus;
    renewsAt?: Date | null;
  }) {
    const priceCents =
      input.plan === "pro" ? 999 : input.plan === "team" ? 1499 : 0;
    let saved:
      | {
          id: string;
          userId: string;
          plan: string;
          status: string;
          priceCents: number;
          renewsAt: Date | null;
          createdAt: Date;
          updatedAt: Date;
        }
      | undefined;
    try {
      [saved] = await db
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
    } catch (error) {
      if (!isMissingSubscriptionsTableError(error)) {
        throw error;
      }
      logMissingSubscriptionsTable(error);
      throw new Error(
        "Subscription persistence is unavailable because the user_subscriptions table is missing."
      );
    }

    if (!saved) throw new Error("Failed to update subscription");
    return saved;
  },

  async isPro(userId: string): Promise<boolean> {
    let sub:
      | {
          plan: string;
          status: string;
        }
      | undefined;
    try {
      [sub] = await db
        .select({ plan: userSubscriptions.plan, status: userSubscriptions.status })
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, userId))
        .limit(1);
    } catch (error) {
      if (!isMissingSubscriptionsTableError(error)) {
        throw error;
      }
      logMissingSubscriptionsTable(error);
      return false;
    }

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
    let sub: { id: string } | undefined;
    try {
      [sub] = await db
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
    } catch (error) {
      if (!isMissingSubscriptionsTableError(error)) {
        throw error;
      }
      logMissingSubscriptionsTable(error);
      return false;
    }
    return Boolean(sub);
  },
};
