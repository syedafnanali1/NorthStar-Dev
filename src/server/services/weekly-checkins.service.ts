import { format, startOfWeek } from "date-fns";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { circlePosts, weeklyAccountabilityCheckins } from "@/drizzle/schema";
import { aiCoachService } from "./ai-coach.service";
import { notificationsService } from "./notifications.service";

function getWeekStartKey(date = new Date()): string {
  return format(startOfWeek(date, { weekStartsOn: 0 }), "yyyy-MM-dd");
}

function defaultReport(answers: string[]): string {
  return [
    "Wins: You showed up and reflected honestly this week.",
    `Patterns: ${answers[2] ? answers[2].slice(0, 140) : "You identified useful behavior patterns."}`,
    `Focus Areas: ${answers[4] ? answers[4].slice(0, 140) : "Choose one concrete action for the coming week."}`,
  ].join(" ");
}

export const weeklyCheckinsService = {
  getWeekStartKey,

  async getLatest(userId: string) {
    const [row] = await db
      .select()
      .from(weeklyAccountabilityCheckins)
      .where(eq(weeklyAccountabilityCheckins.userId, userId))
      .orderBy(desc(weeklyAccountabilityCheckins.weekStartDate))
      .limit(1);
    return row ?? null;
  },

  async getForCurrentWeek(userId: string) {
    const weekStartDate = getWeekStartKey();
    const [row] = await db
      .select()
      .from(weeklyAccountabilityCheckins)
      .where(
        and(
          eq(weeklyAccountabilityCheckins.userId, userId),
          eq(weeklyAccountabilityCheckins.weekStartDate, weekStartDate)
        )
      )
      .limit(1);
    return row ?? null;
  },

  async submitCheckin(input: {
    userId: string;
    answers: string[];
    shareToCircle?: boolean;
  }) {
    if (input.answers.length !== 5) {
      throw new Error("Weekly check-in requires exactly 5 answers.");
    }
    if (input.answers.some((answer) => answer.trim().length < 2)) {
      throw new Error("Each answer must be at least 2 characters.");
    }

    const weekStartDate = getWeekStartKey();
    let aiReport = defaultReport(input.answers);
    try {
      aiReport = await aiCoachService.generateWeeklyReview(input.userId);
    } catch {
      aiReport = defaultReport(input.answers);
    }

    const [saved] = await db
      .insert(weeklyAccountabilityCheckins)
      .values({
        userId: input.userId,
        weekStartDate,
        answers: input.answers.map((answer) => answer.trim()),
        aiReport,
        sharedToCircle: Boolean(input.shareToCircle),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          weeklyAccountabilityCheckins.userId,
          weeklyAccountabilityCheckins.weekStartDate,
        ],
        set: {
          answers: input.answers.map((answer) => answer.trim()),
          aiReport,
          sharedToCircle: Boolean(input.shareToCircle),
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!saved) {
      throw new Error("Failed to save weekly check-in");
    }

    if (input.shareToCircle) {
      await db.insert(circlePosts).values({
        userId: input.userId,
        text: `Weekly accountability check-in complete: ${aiReport.slice(0, 220)}`,
        visibility: "circle",
      });
    }

    await notificationsService.createNotification(
      input.userId,
      "weekly_review",
      "Weekly accountability report ready",
      aiReport.slice(0, 180),
      "/dashboard"
    );

    return saved;
  },
};

