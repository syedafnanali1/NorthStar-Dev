// src/server/services/achievements.service.ts
// Achievement definitions and award logic

import { db } from "@/lib/db";
import { userAchievements } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

export interface Achievement {
  key: string;
  title: string;
  description: string;
  emoji: string;
  rarity: "common" | "uncommon" | "rare" | "legendary";
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    key: "first_star",
    title: "First Star",
    description: "Plant your first goal",
    emoji: "⭐",
    rarity: "common",
  },
  {
    key: "constellation",
    title: "Constellation",
    description: "Create 3 goals",
    emoji: "✨",
    rarity: "common",
  },
  {
    key: "ignition",
    title: "Ignition",
    description: "Complete your first day log",
    emoji: "🔥",
    rarity: "common",
  },
  {
    key: "electric",
    title: "Electric",
    description: "Reach a 7-day streak",
    emoji: "⚡",
    rarity: "uncommon",
  },
  {
    key: "unstoppable",
    title: "Unstoppable",
    description: "Reach a 30-day streak",
    emoji: "🚀",
    rarity: "rare",
  },
  {
    key: "bullseye",
    title: "Bullseye",
    description: "Complete your first goal",
    emoji: "🎯",
    rarity: "uncommon",
  },
  {
    key: "halfway",
    title: "Halfway There",
    description: "Hit 50% of milestones on a goal",
    emoji: "🌓",
    rarity: "common",
  },
  {
    key: "champion",
    title: "Champion",
    description: "Complete 5 goals",
    emoji: "🏆",
    rarity: "rare",
  },
  {
    key: "storyteller",
    title: "Storyteller",
    description: "Write 5 moments",
    emoji: "📖",
    rarity: "common",
  },
  {
    key: "accountable",
    title: "Accountable",
    description: "Share a goal with your circle",
    emoji: "🤝",
    rarity: "common",
  },
  {
    key: "launchpad",
    title: "Launchpad",
    description: "Invite a friend to North Star",
    emoji: "🛸",
    rarity: "uncommon",
  },
  {
    key: "data_driven",
    title: "Data Driven",
    description: "Log progress 20 times",
    emoji: "📊",
    rarity: "uncommon",
  },
];

export const achievementService = {
  /**
   * Award an achievement to a user (idempotent — won't duplicate)
   */
  async award(userId: string, key: string): Promise<boolean> {
    // Check if already earned
    const [existing] = await db
      .select()
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.userId, userId),
          eq(userAchievements.achievementKey, key)
        )
      )
      .limit(1);

    if (existing) return false;

    await db.insert(userAchievements).values({ userId, achievementKey: key });
    return true;
  },

  /**
   * Get all earned achievements for a user
   */
  async getForUser(userId: string): Promise<Array<Achievement & { earnedAt: Date }>> {
    const earned = await db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId));

    return earned
      .map((e) => {
        const def = ACHIEVEMENTS.find((a) => a.key === e.achievementKey);
        if (!def) return null;
        return { ...def, earnedAt: e.earnedAt };
      })
      .filter((a): a is Achievement & { earnedAt: Date } => a !== null);
  },

  /**
   * Get all achievements with earned status
   */
  async getAllWithStatus(userId: string): Promise<Array<Achievement & { earned: boolean; earnedAt?: Date }>> {
    const earned = await db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId));

    const earnedMap = new Map(earned.map((e) => [e.achievementKey, e.earnedAt]));

    return ACHIEVEMENTS.map((a) => ({
      ...a,
      earned: earnedMap.has(a.key),
      earnedAt: earnedMap.get(a.key),
    }));
  },
};
