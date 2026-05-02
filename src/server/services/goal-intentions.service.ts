import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { goalIntentions, intentionRsvps, users } from "@/drizzle/schema";
import type { GoalIntention } from "@/drizzle/schema";

export interface IntentionWithRsvps extends GoalIntention {
  rsvps: Array<{
    userId: string;
    status: "attending" | "not_attending";
    user: { name: string | null; image: string | null };
  }>;
}

export interface CreateIntentionInput {
  title: string;
  scheduledAt?: Date | null;
  recurrence?: "none" | "daily" | "weekly" | "monthly" | "custom";
  notes?: string | null;
}

export const goalIntentionsService = {
  async listForGoal(goalId: string): Promise<IntentionWithRsvps[]> {
    const rows = await db
      .select()
      .from(goalIntentions)
      .where(eq(goalIntentions.goalId, goalId))
      .orderBy(desc(goalIntentions.createdAt));

    if (rows.length === 0) return [];

    const intentionIds = rows.map((r) => r.id);
    const { inArray } = await import("drizzle-orm");
    const allRsvps = await db
      .select({
        intentionId: intentionRsvps.intentionId,
        userId: intentionRsvps.userId,
        status: intentionRsvps.status,
        name: users.name,
        image: users.image,
      })
      .from(intentionRsvps)
      .leftJoin(users, eq(intentionRsvps.userId, users.id))
      .where(inArray(intentionRsvps.intentionId, intentionIds));

    const rsvpMap = new Map<string, IntentionWithRsvps["rsvps"]>();
    for (const rsvp of allRsvps) {
      const list = rsvpMap.get(rsvp.intentionId) ?? [];
      list.push({
        userId: rsvp.userId,
        status: rsvp.status as "attending" | "not_attending",
        user: { name: rsvp.name ?? null, image: rsvp.image ?? null },
      });
      rsvpMap.set(rsvp.intentionId, list);
    }

    return rows.map((row) => ({
      ...row,
      rsvps: rsvpMap.get(row.id) ?? [],
    }));
  },

  async create(
    goalId: string,
    userId: string,
    input: CreateIntentionInput
  ): Promise<GoalIntention> {
    const [created] = await db
      .insert(goalIntentions)
      .values({
        id: `gin_${nanoid(12)}`,
        goalId,
        userId,
        title: input.title.trim(),
        scheduledAt: input.scheduledAt ?? null,
        recurrence: input.recurrence ?? "none",
        notes: input.notes?.trim() ?? null,
        isDefault: false,
      })
      .returning();

    if (!created) throw new Error("Failed to create intention");
    return created;
  },

  async ensureDefaultIntention(goalId: string, userId: string, goalTitle: string): Promise<void> {
    const existing = await db
      .select({ id: goalIntentions.id })
      .from(goalIntentions)
      .where(and(eq(goalIntentions.goalId, goalId), eq(goalIntentions.isDefault, true)))
      .limit(1);

    if (existing.length > 0) return;

    await db.insert(goalIntentions).values({
      id: `gin_${nanoid(12)}`,
      goalId,
      userId,
      title: "I was here",
      scheduledAt: new Date(),
      recurrence: "none",
      notes: `Starting point for: ${goalTitle}`,
      isDefault: true,
    });
  },

  async update(
    intentionId: string,
    userId: string,
    input: Partial<CreateIntentionInput>
  ): Promise<GoalIntention> {
    const [updated] = await db
      .update(goalIntentions)
      .set({
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt } : {}),
        ...(input.recurrence !== undefined ? { recurrence: input.recurrence } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() ?? null } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(goalIntentions.id, intentionId), eq(goalIntentions.userId, userId)))
      .returning();

    if (!updated) throw new Error("Intention not found or not yours");
    return updated;
  },

  async delete(intentionId: string, userId: string): Promise<void> {
    await db
      .delete(goalIntentions)
      .where(and(eq(goalIntentions.id, intentionId), eq(goalIntentions.userId, userId)));
  },

  async upsertRsvp(
    intentionId: string,
    userId: string,
    status: "attending" | "not_attending"
  ): Promise<void> {
    await db
      .insert(intentionRsvps)
      .values({
        id: `rsvp_${nanoid(12)}`,
        intentionId,
        userId,
        status,
      })
      .onConflictDoUpdate({
        target: [intentionRsvps.intentionId, intentionRsvps.userId],
        set: { status },
      });
  },

  buildIcsContent(intention: GoalIntention, attendees: string[]): string {
    const now = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
    const start = intention.scheduledAt ?? new Date();
    const dtStart = start.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
    const dtEnd = new Date(start.getTime() + 60 * 60 * 1000)
      .toISOString()
      .replace(/[-:.]/g, "")
      .slice(0, 15) + "Z";

    const rrule =
      intention.recurrence === "daily"
        ? "\r\nRRULE:FREQ=DAILY"
        : intention.recurrence === "weekly"
        ? "\r\nRRULE:FREQ=WEEKLY"
        : intention.recurrence === "monthly"
        ? "\r\nRRULE:FREQ=MONTHLY"
        : "";

    const description = [
      intention.notes ?? "",
      attendees.length > 0 ? `Attending: ${attendees.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\\n");

    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//NorthStar//GoalIntention//EN",
      "BEGIN:VEVENT",
      `UID:${intention.id}@northstar`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${intention.title}`,
      description ? `DESCRIPTION:${description}` : "",
      rrule,
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n");
  },
};
