// src/server/services/group-goal-items.service.ts
// Business logic for group goal items — creation (manual & AI), member tracking,
// check-ins, aggregate progress, and leaderboards.

import { db } from "@/lib/db";
import {
  groupGoalItems,
  groupGoalMemberTrackers,
  groupGoalCheckIns,
  groupMembers,
  groups,
  users,
} from "@/drizzle/schema";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  sql,
} from "drizzle-orm";
import { groupsService } from "./groups.service";
import { groupEngagementService } from "./group-engagement.service";
import type {
  GroupGoalItem,
  GroupGoalMemberTracker,
} from "@/drizzle/schema";

// ─── Public types ─────────────────────────────────────────────────────────────

export type TrackingFrequency = "daily" | "weekly" | "monthly" | "yearly" | "custom";
export type GoalCategory = "health" | "finance" | "writing" | "body" | "mindset" | "custom";

export interface CreateGroupGoalInput {
  title: string;
  description?: string;
  category: GoalCategory;
  trackingFrequency: TrackingFrequency;
  customFrequencyLabel?: string;
  milestones?: string[];
  targetValue?: number;
  unit?: string;
  emoji?: string;
  createdVia: "manual" | "ai";
}

export interface AiGoalSuggestion {
  title: string;
  description: string;
  category: GoalCategory;
  trackingFrequency: TrackingFrequency;
  milestones: string[];
  emoji: string;
}

export interface GroupGoalWithMeta extends GroupGoalItem {
  trackerCount: number;       // how many members added this to their calendar
  completedCount: number;     // how many marked as completed
  aggregateCheckIns: number;  // total check-ins across all trackers
  myTracker: GroupGoalMemberTracker | null;
  leaderboard: Array<{
    userId: string;
    name: string | null;
    image: string | null;
    checkIns: number;
    isCompleted: boolean;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireAdminOrOwner(groupId: string, userId: string): Promise<void> {
  const [m] = await db
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId),
        eq(groupMembers.status, "active")
      )
    )
    .limit(1);
  if (!m || !["owner", "admin"].includes(m.role)) {
    throw new Error("Only group owners and admins can perform this action.");
  }
}

async function requireActiveMember(groupId: string, userId: string): Promise<void> {
  const [m] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId),
        eq(groupMembers.status, "active")
      )
    )
    .limit(1);
  if (!m) throw new Error("You must be a group member to do this.");
}

function parseJson(text: string): unknown {
  return JSON.parse(
    text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim()
  );
}

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 600
): Promise<string | null> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey || apiKey === "sk-ant-your-key-here") return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    return data.content.find((c) => c.type === "text")?.text ?? null;
  } catch {
    return null;
  }
}

function fallbackSuggestGoal(description: string): AiGoalSuggestion {
  const t = description.toLowerCase();
  const category: GoalCategory = /save|budget|money|invest/.test(t)
    ? "finance"
    : /write|book|blog|word/.test(t)
      ? "writing"
      : /weight|muscle|nutrition|calorie/.test(t)
        ? "body"
        : /meditat|mindful|journal|learn/.test(t)
          ? "mindset"
          : /run|workout|exercise|marathon|sleep/.test(t)
            ? "health"
            : "custom";

  const emojiMap: Record<GoalCategory, string> = {
    finance: "💰", writing: "✍️", body: "💪", mindset: "🧠", health: "🏃", custom: "⭐",
  };

  const title = description.length <= 80
    ? `${description.charAt(0).toUpperCase()}${description.slice(1).replace(/[.!?]$/, "")}`
    : "Group Achievement Goal";

  return {
    title,
    description: `A shared group goal to ${description.toLowerCase().replace(/[.!?]$/, "")}.`,
    category,
    trackingFrequency: "weekly",
    milestones: [
      "Complete your first full week of check-ins",
      "Hit the halfway point as a team",
      "Celebrate 75% group completion",
      "Cross the finish line together",
    ],
    emoji: emojiMap[category],
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const groupGoalItemsService = {
  /**
   * Fetch all active group goals for a group, with aggregate stats and
   * the current user's tracker if they've added a goal to their calendar.
   */
  async getGroupGoals(
    groupId: string,
    userId: string
  ): Promise<GroupGoalWithMeta[]> {
    const goalRows = await db
      .select()
      .from(groupGoalItems)
      .where(
        and(
          eq(groupGoalItems.groupId, groupId),
          eq(groupGoalItems.status, "active")
        )
      )
      .orderBy(asc(groupGoalItems.createdAt));

    if (goalRows.length === 0) return [];

    const goalIds = goalRows.map((g) => g.id);

    // Aggregate tracker stats per goal
    const trackerStats = await db
      .select({
        goalId: groupGoalMemberTrackers.groupGoalItemId,
        trackerCount: count(),
        completedCount: sql<number>`sum(case when ${groupGoalMemberTrackers.isCompleted} then 1 else 0 end)`,
        aggregateCheckIns: sql<number>`coalesce(sum(${groupGoalMemberTrackers.checkInsCompleted}), 0)`,
      })
      .from(groupGoalMemberTrackers)
      .where(inArray(groupGoalMemberTrackers.groupGoalItemId, goalIds))
      .groupBy(groupGoalMemberTrackers.groupGoalItemId);

    const statsMap = new Map(trackerStats.map((s) => [s.goalId, s]));

    // My trackers
    const myTrackers = await db
      .select()
      .from(groupGoalMemberTrackers)
      .where(
        and(
          inArray(groupGoalMemberTrackers.groupGoalItemId, goalIds),
          eq(groupGoalMemberTrackers.userId, userId)
        )
      );
    const myTrackerMap = new Map(myTrackers.map((t) => [t.groupGoalItemId, t]));

    // Leaderboard top-5 per goal
    const leaderboardRows = await db
      .select({
        goalId: groupGoalMemberTrackers.groupGoalItemId,
        userId: groupGoalMemberTrackers.userId,
        checkIns: groupGoalMemberTrackers.checkInsCompleted,
        isCompleted: groupGoalMemberTrackers.isCompleted,
        name: users.name,
        image: users.image,
      })
      .from(groupGoalMemberTrackers)
      .innerJoin(users, eq(groupGoalMemberTrackers.userId, users.id))
      .where(inArray(groupGoalMemberTrackers.groupGoalItemId, goalIds))
      .orderBy(
        desc(groupGoalMemberTrackers.checkInsCompleted),
        asc(groupGoalMemberTrackers.addedAt)
      )
      .limit(goalIds.length * 5);

    const leaderboardByGoal = new Map<
      string,
      Array<{ userId: string; name: string | null; image: string | null; checkIns: number; isCompleted: boolean }>
    >();
    for (const row of leaderboardRows) {
      const arr = leaderboardByGoal.get(row.goalId) ?? [];
      if (arr.length < 5) {
        arr.push({
          userId: row.userId,
          name: row.name,
          image: row.image,
          checkIns: row.checkIns,
          isCompleted: row.isCompleted,
        });
      }
      leaderboardByGoal.set(row.goalId, arr);
    }

    return goalRows.map((g) => {
      const stats = statsMap.get(g.id);
      return {
        ...g,
        trackerCount: stats?.trackerCount ?? 0,
        completedCount: Number(stats?.completedCount ?? 0),
        aggregateCheckIns: Number(stats?.aggregateCheckIns ?? 0),
        myTracker: myTrackerMap.get(g.id) ?? null,
        leaderboard: leaderboardByGoal.get(g.id) ?? [],
      };
    });
  },

  /**
   * Create a group goal (owner/admin only).
   */
  async createGroupGoal(
    groupId: string,
    creatorId: string,
    input: CreateGroupGoalInput
  ): Promise<GroupGoalItem> {
    await requireAdminOrOwner(groupId, creatorId);

    const [goal] = await db
      .insert(groupGoalItems)
      .values({
        groupId,
        createdBy: creatorId,
        title: input.title.trim(),
        description: input.description?.trim() ?? null,
        category: input.category,
        trackingFrequency: input.trackingFrequency,
        customFrequencyLabel: input.customFrequencyLabel?.trim() ?? null,
        milestones: (input.milestones ?? []).filter(Boolean),
        targetValue: input.targetValue ?? null,
        unit: input.unit?.trim() ?? null,
        emoji: input.emoji ?? null,
        createdVia: input.createdVia,
      })
      .returning();

    if (!goal) throw new Error("Failed to create goal.");

    // Trigger popularity score recalculation
    void groupsService.recalculatePopularityScore(groupId);

    return goal;
  },

  /**
   * AI-generated group goal suggestion.
   * Falls back to a rule-based suggestion if Claude is unavailable.
   */
  async suggestGroupGoal(description: string): Promise<AiGoalSuggestion> {
    const fallback = fallbackSuggestGoal(description);

    const systemPrompt = [
      "You are a group goal design expert for a productivity and accountability app.",
      "Return ONLY valid JSON with these exact keys:",
      '  title (string, max 80 chars),',
      '  description (string, 1-2 sentences, max 200 chars),',
      '  category (one of: health|finance|writing|body|mindset|custom),',
      '  trackingFrequency (one of: daily|weekly|monthly|yearly|custom),',
      '  milestones (array of 3-5 short strings, each max 80 chars),',
      '  emoji (single emoji character)',
      "Make milestones feel like team achievements, not individual ones.",
      "No extra text, no markdown, just the JSON object.",
    ].join("\n");

    const userPrompt = `Group wants to: ${description}`;
    const raw = await callClaude(systemPrompt, userPrompt, 500);
    if (!raw) return fallback;

    try {
      const parsed = parseJson(raw) as Partial<AiGoalSuggestion>;
      const validFrequencies: TrackingFrequency[] = ["daily", "weekly", "monthly", "yearly", "custom"];
      const validCategories: GoalCategory[] = ["health", "finance", "writing", "body", "mindset", "custom"];

      return {
        title: (typeof parsed.title === "string" ? parsed.title : fallback.title).slice(0, 80),
        description: (typeof parsed.description === "string" ? parsed.description : fallback.description).slice(0, 200),
        category: validCategories.includes(parsed.category as GoalCategory)
          ? (parsed.category as GoalCategory)
          : fallback.category,
        trackingFrequency: validFrequencies.includes(parsed.trackingFrequency as TrackingFrequency)
          ? (parsed.trackingFrequency as TrackingFrequency)
          : fallback.trackingFrequency,
        milestones: Array.isArray(parsed.milestones)
          ? (parsed.milestones as string[]).slice(0, 5).map((m: string) => String(m).slice(0, 80))
          : fallback.milestones,
        emoji: typeof parsed.emoji === "string" && parsed.emoji.length <= 4
          ? parsed.emoji
          : fallback.emoji,
      };
    } catch {
      return fallback;
    }
  },

  /**
   * Toggle "Add to My Calendar" — creates or removes a tracker for the user.
   * Returns the tracker if added, null if removed.
   */
  async toggleCalendarTracker(
    groupGoalItemId: string,
    userId: string
  ): Promise<GroupGoalMemberTracker | null> {
    // Fetch goal to get groupId
    const [goal] = await db
      .select({ groupId: groupGoalItems.groupId })
      .from(groupGoalItems)
      .where(eq(groupGoalItems.id, groupGoalItemId))
      .limit(1);

    if (!goal) throw new Error("Goal not found.");
    await requireActiveMember(goal.groupId, userId);

    // Check if tracker exists
    const [existing] = await db
      .select()
      .from(groupGoalMemberTrackers)
      .where(
        and(
          eq(groupGoalMemberTrackers.groupGoalItemId, groupGoalItemId),
          eq(groupGoalMemberTrackers.userId, userId)
        )
      )
      .limit(1);

    if (existing) {
      // Remove tracker + its check-ins (cascade handles check-ins)
      await db
        .delete(groupGoalMemberTrackers)
        .where(eq(groupGoalMemberTrackers.id, existing.id));
      return null;
    }

    // Create tracker
    const [tracker] = await db
      .insert(groupGoalMemberTrackers)
      .values({
        groupGoalItemId,
        userId,
        groupId: goal.groupId,
      })
      .returning();

    if (!tracker) throw new Error("Failed to add goal to calendar.");

    // Recalculate popularity score after new tracker
    void groupsService.recalculatePopularityScore(goal.groupId);
    // Behavior profile: calendar add action (non-blocking)
    void groupEngagementService.updateBehaviorProfile(userId, "add_to_calendar", { groupId: goal.groupId, goalId: groupGoalItemId });

    return tracker;
  },

  /**
   * Log a check-in (progress) for a user's tracker.
   * Increments checkInsCompleted and records the entry.
   */
  async logCheckIn(
    groupGoalItemId: string,
    userId: string,
    value = 1,
    note?: string
  ): Promise<void> {
    const [tracker] = await db
      .select()
      .from(groupGoalMemberTrackers)
      .where(
        and(
          eq(groupGoalMemberTrackers.groupGoalItemId, groupGoalItemId),
          eq(groupGoalMemberTrackers.userId, userId)
        )
      )
      .limit(1);

    if (!tracker) {
      throw new Error("Add this goal to your calendar first before logging progress.");
    }

    // Insert check-in
    await db.insert(groupGoalCheckIns).values({
      trackerId: tracker.id,
      groupGoalItemId,
      userId,
      value,
      note: note?.trim() ?? null,
    });

    // Update tracker counters
    await db
      .update(groupGoalMemberTrackers)
      .set({
        checkInsCompleted: sql`${groupGoalMemberTrackers.checkInsCompleted} + 1`,
        lastCheckedInAt: new Date(),
      })
      .where(eq(groupGoalMemberTrackers.id, tracker.id));

    // Recalculate popularity (goal completion feeds into the score)
    void groupsService.recalculatePopularityScore(tracker.groupId);
    // Per-group engagement + badge check (non-blocking)
    void groupEngagementService.updateBehaviorProfile(userId, "complete_goal", { groupId: tracker.groupId, goalId: groupGoalItemId, outcome: "checkin" });
    void groupEngagementService.checkAndAwardBadges(userId);
  },

  /**
   * Mark a tracker as completed (user self-reports goal complete).
   */
  async markCompleted(groupGoalItemId: string, userId: string): Promise<void> {
    const [tracker] = await db
      .select({ id: groupGoalMemberTrackers.id, groupId: groupGoalMemberTrackers.groupId })
      .from(groupGoalMemberTrackers)
      .where(
        and(
          eq(groupGoalMemberTrackers.groupGoalItemId, groupGoalItemId),
          eq(groupGoalMemberTrackers.userId, userId)
        )
      )
      .limit(1);

    if (!tracker) throw new Error("You haven't added this goal to your calendar.");

    await db
      .update(groupGoalMemberTrackers)
      .set({ isCompleted: true })
      .where(eq(groupGoalMemberTrackers.id, tracker.id));

    void groupsService.recalculatePopularityScore(tracker.groupId);
    // Per-group engagement: goal fully completed (non-blocking)
    void groupEngagementService.incrementGoalCompletion(userId, tracker.groupId);
  },

  /**
   * Get recent check-ins for a specific tracker (for the user's personal log).
   */
  async getMyCheckIns(groupGoalItemId: string, userId: string, limit = 10) {
    const [tracker] = await db
      .select({ id: groupGoalMemberTrackers.id })
      .from(groupGoalMemberTrackers)
      .where(
        and(
          eq(groupGoalMemberTrackers.groupGoalItemId, groupGoalItemId),
          eq(groupGoalMemberTrackers.userId, userId)
        )
      )
      .limit(1);

    if (!tracker) return [];

    return db
      .select()
      .from(groupGoalCheckIns)
      .where(eq(groupGoalCheckIns.trackerId, tracker.id))
      .orderBy(desc(groupGoalCheckIns.loggedAt))
      .limit(limit);
  },

  /**
   * Archive a group goal (owner/admin only).
   */
  async archiveGroupGoal(
    groupGoalItemId: string,
    groupId: string,
    userId: string
  ): Promise<void> {
    await requireAdminOrOwner(groupId, userId);
    await db
      .update(groupGoalItems)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(groupGoalItems.id, groupGoalItemId));
  },

  /**
   * Fetch group goals added to the current user's calendar (for personal dashboard).
   */
  async getMyGroupGoals(userId: string) {
    const trackers = await db
      .select({
        tracker: groupGoalMemberTrackers,
        goal: groupGoalItems,
        groupName: groups.name,
      })
      .from(groupGoalMemberTrackers)
      .innerJoin(
        groupGoalItems,
        eq(groupGoalMemberTrackers.groupGoalItemId, groupGoalItems.id)
      )
      .innerJoin(groups, eq(groupGoalMemberTrackers.groupId, groups.id))
      .where(
        and(
          eq(groupGoalMemberTrackers.userId, userId),
          eq(groupGoalItems.status, "active")
        )
      )
      .orderBy(desc(groupGoalMemberTrackers.addedAt));

    return trackers;
  },
};
