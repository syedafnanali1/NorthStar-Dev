import crypto from "node:crypto";
import { eq, and, inArray, or, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import {
  integrationConnections,
  webhookSubscriptions,
} from "@/drizzle/schema";

function signPayload(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export const integrationsService = {
  async listConnections(userId: string) {
    return db
      .select()
      .from(integrationConnections)
      .where(eq(integrationConnections.userId, userId));
  },

  async connect(input: {
    userId: string;
    provider: string;
    accessToken?: string;
    refreshToken?: string;
    config?: Record<string, unknown>;
    isActive?: boolean;
  }) {
    const provider = input.provider.trim().toLowerCase();
    if (!provider) throw new Error("Provider is required.");

    const [connection] = await db
      .insert(integrationConnections)
      .values({
        userId: input.userId,
        provider,
        accessToken: input.accessToken ?? null,
        refreshToken: input.refreshToken ?? null,
        config: input.config ?? {},
        isActive: input.isActive ?? true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [integrationConnections.userId, integrationConnections.provider],
        set: {
          accessToken: input.accessToken ?? null,
          refreshToken: input.refreshToken ?? null,
          config: input.config ?? {},
          isActive: input.isActive ?? true,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!connection) throw new Error("Failed to save integration connection.");
    return connection;
  },

  async listWebhooks(userId: string) {
    return db
      .select()
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.userId, userId));
  },

  async registerWebhook(input: {
    userId: string;
    endpointUrl: string;
    events: string[];
    teamId?: string;
  }) {
    const [webhook] = await db
      .insert(webhookSubscriptions)
      .values({
        userId: input.userId,
        teamId: input.teamId ?? null,
        endpointUrl: input.endpointUrl,
        events: input.events,
        secret: `whsec_${nanoid(32)}`,
        isActive: true,
        updatedAt: new Date(),
      })
      .returning();

    if (!webhook) throw new Error("Failed to register webhook.");
    return webhook;
  },

  async emitEvent(input: {
    userIds: string[];
    event: string;
    payload: Record<string, unknown>;
    teamId?: string;
  }) {
    if (input.userIds.length === 0) return { attempted: 0, delivered: 0, failed: 0 };

    const hooks = await db
      .select()
      .from(webhookSubscriptions)
      .where(
        and(
          inArray(webhookSubscriptions.userId, input.userIds),
          eq(webhookSubscriptions.isActive, true),
          input.teamId
            ? or(
                eq(webhookSubscriptions.teamId, input.teamId),
                isNull(webhookSubscriptions.teamId)
              )
            : isNull(webhookSubscriptions.teamId)
        )
      );

    const matched = hooks.filter(
      (hook) => hook.events.includes("*") || hook.events.includes(input.event)
    );
    if (matched.length === 0) return { attempted: 0, delivered: 0, failed: 0 };

    const body = JSON.stringify({
      event: input.event,
      occurredAt: new Date().toISOString(),
      payload: input.payload,
    });

    let delivered = 0;
    let failed = 0;

    for (const hook of matched) {
      try {
        const signature = signPayload(hook.secret, body);
        const response = await fetch(hook.endpointUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Northstar-Event": input.event,
            "X-Northstar-Signature": signature,
          },
          body,
        });
        if (response.ok) delivered += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
    }

    return {
      attempted: matched.length,
      delivered,
      failed,
    };
  },
};
