// src/server/services/goals.service.ts
// All business logic for goals lives here.
// This layer is called by API routes — never by components directly.

import { db } from "@/lib/db";
import {
  goals,
  goalTasks,
  progressEntries,
  moments,
  users,
} from "@/drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import type {
  Goal,
  NewGoal,
  GoalTask,
  ProgressEntry,
  Moment,
} from "@/drizzle/schema";
import type { CreateGoalInput, LogProgressInput, CreateMomentInput } from "@/lib/validators/goals";
import { achievementService } from "./achievements.service";
import { inferTaskIncrementFromText } from "@/lib/progress-intelligence";
import { aiCoachService } from "./ai-coach.service";
import { friendActivityService } from "./friend-activity.service";
import { xpService } from "./xp.service";
import { subscriptionsService } from "./subscriptions.service";
import { integrationsService } from "./integrations.service";
import { notificationsService } from "./notifications.service";

export interface GoalWithDetails extends Goal {
  tasks: GoalTask[];
  recentProgress: ProgressEntry[];
  recentMoments: Moment[];
  percentComplete: number;
}

export const goalsService = {
  /**
   * Get all goals for a user with their tasks and recent progress
   */
  async getAllForUser(userId: string): Promise<GoalWithDetails[]> {
    const userGoals = await db
      .select()
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.isArchived, false)))
      .orderBy(desc(goals.createdAt));

    if (userGoals.length === 0) return [];

    // Batch-fetch tasks and progress for all goals
    const goalIds = userGoals.map((g) => g.id);

    const allTasks = await db
      .select()
      .from(goalTasks)
      .where(
        sql`${goalTasks.goalId} = ANY(${sql.raw(`ARRAY[${goalIds.map((id) => `'${id}'`).join(",")}]::text[]`)})`
      )
      .orderBy(goalTasks.order);

    const allProgress = await db
      .select()
      .from(progressEntries)
      .where(
        sql`${progressEntries.goalId} = ANY(${sql.raw(`ARRAY[${goalIds.map((id) => `'${id}'`).join(",")}]::text[]`)})`
      )
      .orderBy(desc(progressEntries.loggedAt))
      .limit(goalIds.length * 5);

    const allMoments = await db
      .select()
      .from(moments)
      .where(
        sql`${moments.goalId} = ANY(${sql.raw(`ARRAY[${goalIds.map((id) => `'${id}'`).join(",")}]::text[]`)})`
      )
      .orderBy(desc(moments.createdAt))
      .limit(goalIds.length * 3);

    return userGoals.map((goal) => ({
      ...goal,
      tasks: allTasks.filter((t) => t.goalId === goal.id),
      recentProgress: allProgress.filter((p) => p.goalId === goal.id).slice(0, 5),
      recentMoments: allMoments.filter((m) => m.goalId === goal.id).slice(0, 3),
      percentComplete: goal.targetValue
        ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))
        : 0,
    }));
  },

  /**
   * Get a single goal with full details
   */
  async getById(goalId: string, userId: string): Promise<GoalWithDetails | null> {
    const [goal] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);

    if (!goal) return null;

    const [tasks, recentProgress, recentMoments] = await Promise.all([
      db
        .select()
        .from(goalTasks)
        .where(eq(goalTasks.goalId, goalId))
        .orderBy(goalTasks.order),
      db
        .select()
        .from(progressEntries)
        .where(eq(progressEntries.goalId, goalId))
        .orderBy(desc(progressEntries.loggedAt))
        .limit(20),
      db
        .select({
          moment: moments,
          userName: users.name,
          userImage: users.image,
        })
        .from(moments)
        .leftJoin(users, eq(moments.userId, users.id))
        .where(eq(moments.goalId, goalId))
        .orderBy(desc(moments.createdAt))
        .limit(10),
    ]);

    return {
      ...goal,
      tasks,
      recentProgress,
      recentMoments: recentMoments.map((r) => r.moment),
      percentComplete: goal.targetValue
        ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))
        : 0,
    };
  },

  /**
   * Create a new goal with optional linked tasks
   */
  async create(userId: string, input: CreateGoalInput): Promise<Goal> {
    const goalLimit = await subscriptionsService.getGoalLimit(userId);
    if (goalLimit !== null) {
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(goals)
        .where(and(eq(goals.userId, userId), eq(goals.isArchived, false)));
      if ((countRow?.count ?? 0) >= goalLimit) {
        throw new Error(
          `Free plan supports up to ${goalLimit} active goals. Upgrade to North Star Pro for unlimited goals.`
        );
      }
    }

    const newGoal: NewGoal = {
      userId,
      title: input.title,
      why: input.why,
      category: input.category,
      color: input.color ?? categoryColors[input.category],
      emoji: input.emoji ?? categoryEmojis[input.category],
      targetValue: input.targetValue,
      currentValue: input.currentValue ?? 0,
      unit: input.unit,
      milestones: input.milestones ?? [],
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      isPublic: input.isPublic ?? false,
    };

    const [goal] = await db.insert(goals).values(newGoal).returning();

    if (!goal) throw new Error("Failed to create goal");

    // Insert linked tasks if provided
    if (input.tasks && input.tasks.length > 0) {
      await db.insert(goalTasks).values(
        input.tasks.map((task, i) => ({
          goalId: goal.id,
          userId,
          text: task.text,
          isRepeating: task.isRepeating,
          order: i,
          incrementValue:
            task.incrementValue ??
            inferTaskIncrementFromText({
              goalTitle: goal.title,
              goalUnit: goal.unit,
              goalCategory: goal.category,
              goalTargetValue: goal.targetValue,
              taskText: task.text,
            }) ??
            null,
        }))
      );
    }

    // Check for first goal achievement
    const goalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(goals)
      .where(eq(goals.userId, userId));

    if (goalCount[0] && goalCount[0].count === 1) {
      await achievementService.award(userId, "first_star");
    } else if (goalCount[0] && goalCount[0].count === 3) {
      await achievementService.award(userId, "constellation");
    }

    return goal;
  },

  /**
   * Log progress for a goal
   */
  async logProgress(
    goalId: string,
    userId: string,
    input: LogProgressInput
  ): Promise<{ goal: Goal; entry: ProgressEntry }> {
    // Verify ownership
    const [goal] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);

    if (!goal) throw new Error("Goal not found");

    // Create progress entry
    const [entry] = await db
      .insert(progressEntries)
      .values({
        goalId,
        userId,
        value: input.value,
        note: input.note,
      })
      .returning();

    if (!entry) throw new Error("Failed to create progress entry");

    // Update goal's current value
    const newCurrent = (goal.currentValue ?? 0) + input.value;
    const isCompleted =
      goal.targetValue !== null &&
      goal.targetValue !== undefined &&
      newCurrent >= goal.targetValue;
    const previousPercent =
      goal.targetValue && goal.targetValue > 0
        ? (goal.currentValue / goal.targetValue) * 100
        : 0;
    const nextPercent =
      goal.targetValue && goal.targetValue > 0
        ? (newCurrent / goal.targetValue) * 100
        : 0;

    const [updatedGoal] = await db
      .update(goals)
      .set({
        currentValue: newCurrent,
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(goals.id, goalId))
      .returning();

    if (!updatedGoal) throw new Error("Failed to update goal");

    void friendActivityService.emitActivity({
      actorUserId: userId,
      type: "progress_log",
      goalId,
      payload: {
        goalTitle: goal.title,
        value: input.value,
        currentValue: newCurrent,
      },
      notifyFriends: false,
      link: `/goals/${goalId}`,
    });

    if (goal.targetValue && goal.targetValue > 0) {
      const milestones = [25, 50, 75, 100].filter(
        (milestone) => previousPercent < milestone && nextPercent >= milestone
      );
      for (const milestone of milestones) {
        void friendActivityService.emitActivity({
          actorUserId: userId,
          type: "goal_milestone",
          goalId,
          payload: {
            goalTitle: goal.title,
            milestone,
            message: `hit ${milestone}% on "${goal.title}"`,
          },
          notifyFriends: true,
          link: `/goals/${goalId}`,
        });
        // In-app milestone notification
        const milestoneEmoji = milestone === 100 ? "🏆" : milestone === 75 ? "🔥" : milestone === 50 ? "⚡" : "🌟";
        void notificationsService.createNotification(
          userId,
          "friend_milestone",
          `${milestoneEmoji} ${milestone}% milestone reached!`,
          `You've hit ${milestone}% on "${goal.title}". Keep going — you're making it happen.`,
          `/goals/${goalId}`
        );
      }
    }

    // Award completion achievement
    if (isCompleted) {
      await achievementService.award(userId, "bullseye");
      const completedCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(goals)
        .where(and(eq(goals.userId, userId), eq(goals.isCompleted, true)));
      if (completedCount[0] && completedCount[0].count >= 5) {
        await achievementService.award(userId, "champion");
      }

      // When a goal is completed, generate a smart "what next" recommendation.
      void aiCoachService.createSmartSuggestionInsight(userId, goalId).catch(() => null);

      void friendActivityService.emitActivity({
        actorUserId: userId,
        type: "goal_completed",
        goalId,
        payload: {
          goalTitle: goal.title,
          message: `completed "${goal.title}"`,
        },
        notifyFriends: true,
        link: `/goals/${goalId}`,
      });

      void integrationsService
        .emitEvent({
          userIds: [userId],
          event: "goal.completed",
          payload: {
            goalId,
            title: goal.title,
            currentValue: newCurrent,
            targetValue: goal.targetValue,
          },
        })
        .catch(() => null);
    }

    // Keep predictive pacing alerts fresh as progress changes.
    void aiCoachService
      .maybeCreatePredictionInsightForGoal(userId, goalId, {
        cooldownHours: 24,
        createNotification: true,
      })
      .catch(() => null);

    void xpService.calculateNorthStarScore(userId).catch(() => null);

    return { goal: updatedGoal, entry };
  },

  /**
   * Add a moment (reflection) to a goal
   */
  async addMoment(
    goalId: string,
    userId: string,
    input: CreateMomentInput
  ): Promise<Moment> {
    // Verify goal ownership
    const [goal] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);

    if (!goal) throw new Error("Goal not found");

    const [moment] = await db
      .insert(moments)
      .values({
        goalId,
        userId,
        text: input.text,
        visibility: input.visibility,
        isPerseverance: input.isPerseverance ?? false,
      })
      .returning();

    if (!moment) throw new Error("Failed to create moment");

    void friendActivityService.emitActivity({
      actorUserId: userId,
      type: "moment_shared",
      goalId,
      payload: {
        goalTitle: goal.title,
        preview: input.text.slice(0, 140),
      },
      notifyFriends: false,
      link: `/goals/${goalId}`,
    });

    // Check storyteller achievement (5+ moments)
    const momentCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(moments)
      .where(eq(moments.userId, userId));

    if (momentCount[0] && momentCount[0].count >= 5) {
      await achievementService.award(userId, "storyteller");
    }

    return moment;
  },

  /**
   * Delete a goal (soft delete via archive)
   */
  async archive(goalId: string, userId: string): Promise<void> {
    await db
      .update(goals)
      .set({ isArchived: true, updatedAt: new Date() })
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)));
  },

  /**
   * Complete a milestone
   */
  async completeMilestone(
    goalId: string,
    userId: string,
    milestone: string
  ): Promise<Goal> {
    const [goal] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);

    if (!goal) throw new Error("Goal not found");

    const completedMilestones = [...(goal.completedMilestones ?? []), milestone];

    const [updated] = await db
      .update(goals)
      .set({ completedMilestones, updatedAt: new Date() })
      .where(eq(goals.id, goalId))
      .returning();

    if (!updated) throw new Error("Failed to update milestone");

    void friendActivityService.emitActivity({
      actorUserId: userId,
      type: "goal_milestone",
      goalId,
      payload: {
        goalTitle: goal.title,
        milestone,
        message: `completed milestone "${milestone}"`,
      },
      notifyFriends: true,
      link: `/goals/${goalId}`,
    });

    // Check halfway achievement
    if (
      goal.milestones &&
      completedMilestones.length >= Math.ceil(goal.milestones.length / 2)
    ) {
      await achievementService.award(userId, "halfway");
    }

    return updated;
  },
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const categoryColors: Record<string, string> = {
  health: "#6B8C7A",  // sage
  finance: "#5B7EA6", // sky
  writing: "#C4963A", // gold
  body: "#B5705B",    // rose
  mindset: "#7B6FA0", // violet
  custom: "#C4963A",  // gold
};

const categoryEmojis: Record<string, string> = {
  health: "🏃",
  finance: "💰",
  writing: "✍️",
  body: "⚖️",
  mindset: "🧠",
  custom: "⭐",
};
