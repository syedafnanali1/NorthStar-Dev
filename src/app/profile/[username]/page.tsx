// src/app/profile/[username]/page.tsx
// Public profile page: avatar, level, North Star score, streak, goals, achievements

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { users, goals } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { AppLayout } from "@/components/layout/app-layout";
import { LevelBadge } from "@/components/ui/level-badge";
import { format } from "date-fns";
import Image from "next/image";
import { cn } from "@/lib/utils/index";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username} — NorthStar` };
}

const ACHIEVEMENT_DEFS = [
  { key: "streak_7", label: "7-Day Streak", emoji: "🔥", description: "Logged 7 days in a row" },
  { key: "streak_30", label: "30-Day Streak", emoji: "💎", description: "Logged 30 days in a row" },
  { key: "goals_1", label: "First Goal", emoji: "⭐", description: "Completed first goal" },
  { key: "goals_5", label: "Goal Crusher", emoji: "🏆", description: "Completed 5 goals" },
  { key: "level_5", label: "Level 5", emoji: "🚀", description: "Reached level 5" },
  { key: "level_10", label: "Level 10", emoji: "✨", description: "Reached level 10" },
];

function getEarnedAchievements(
  longestStreak: number,
  totalGoalsCompleted: number,
  level: number
): string[] {
  const earned: string[] = [];
  if (longestStreak >= 7) earned.push("streak_7");
  if (longestStreak >= 30) earned.push("streak_30");
  if (totalGoalsCompleted >= 1) earned.push("goals_1");
  if (totalGoalsCompleted >= 5) earned.push("goals_5");
  if (level >= 5) earned.push("level_5");
  if (level >= 10) earned.push("level_10");
  return earned;
}

function scoreLabel(score: number): string {
  if (score >= 800) return "Exceptional";
  if (score >= 600) return "Strong";
  if (score >= 400) return "Building";
  if (score >= 200) return "Starting";
  return "Early Stage";
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      image: users.image,
      level: users.level,
      xpPoints: users.xpPoints,
      northStarScore: users.northStarScore,
      currentStreak: users.currentStreak,
      longestStreak: users.longestStreak,
      totalGoalsCompleted: users.totalGoalsCompleted,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user) notFound();

  const publicGoals = await db
    .select({
      id: goals.id,
      title: goals.title,
      emoji: goals.emoji,
      color: goals.color,
      category: goals.category,
      currentValue: goals.currentValue,
      targetValue: goals.targetValue,
      unit: goals.unit,
      isCompleted: goals.isCompleted,
    })
    .from(goals)
    .where(and(eq(goals.userId, user.id), eq(goals.isArchived, false)));

  const earned = getEarnedAchievements(
    user.longestStreak,
    user.totalGoalsCompleted,
    user.level
  );

  const initials = (user.name ?? user.username ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="panel-shell overflow-hidden p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name ?? username}
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-full object-cover ring-2 ring-[#C4963A]/30"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#C4963A]/20 ring-2 ring-[#C4963A]/30">
                  <span className="font-serif text-2xl font-bold text-[#E8C97A]">
                    {initials}
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-serif text-2xl font-bold text-ink">
                  {user.name ?? `@${username}`}
                </h1>
                <LevelBadge level={user.level} xpPoints={user.xpPoints} />
              </div>
              {user.username && (
                <p className="mt-0.5 text-sm text-ink-muted">@{user.username}</p>
              )}
              <p className="mt-1 text-xs text-ink-soft">
                Member since {format(user.createdAt, "MMMM yyyy")}
              </p>
            </div>

            {/* North Star Score */}
            <div className="flex-shrink-0 text-center sm:text-right">
              <p className="font-serif text-4xl font-bold text-[#E8C97A]">
                {user.northStarScore}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
                North Star Score
              </p>
              <p className="mt-0.5 text-xs font-medium text-[#C4963A]">
                {scoreLabel(user.northStarScore)}
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-ink-ghost pt-5">
            <div className="text-center">
              <p className="font-serif text-2xl font-semibold text-ink">{user.currentStreak}</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Day Streak</p>
            </div>
            <div className="text-center">
              <p className="font-serif text-2xl font-semibold text-ink">{user.longestStreak}</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Best Streak</p>
            </div>
            <div className="text-center">
              <p className="font-serif text-2xl font-semibold text-ink">{user.totalGoalsCompleted}</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Goals Done</p>
            </div>
          </div>
        </div>

        {/* Goals */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
            Active Goals
          </h2>
          {publicGoals.length === 0 ? (
            <div className="panel-shell p-6 text-center">
              <p className="text-sm italic text-ink-soft">No public goals yet.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {publicGoals.map((goal) => {
                const pct =
                  goal.targetValue && goal.currentValue !== null
                    ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))
                    : 0;
                return (
                  <div
                    key={goal.id}
                    className="panel-shell flex items-center gap-4 p-4"
                  >
                    <span className="text-2xl">{goal.emoji ?? "⭐"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{goal.title}</p>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-ghost">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: goal.color,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-ink-muted">
                        {goal.currentValue ?? 0}
                        {goal.unit ? ` ${goal.unit}` : ""}
                        {goal.targetValue ? ` / ${goal.targetValue}${goal.unit ? ` ${goal.unit}` : ""}` : ""}
                      </p>
                    </div>
                    {goal.isCompleted && (
                      <span className="flex-shrink-0 rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-semibold text-green-400">
                        Done
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Achievements */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
            Achievements
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {ACHIEVEMENT_DEFS.map((ach) => {
              const unlocked = earned.includes(ach.key);
              return (
                <div
                  key={ach.key}
                  title={ach.description}
                  className={cn(
                    "panel-shell flex flex-col items-center gap-1.5 p-3 text-center transition-opacity",
                    !unlocked && "opacity-30 grayscale"
                  )}
                >
                  <span className="text-2xl">{ach.emoji}</span>
                  <p className="text-[10px] font-medium leading-tight text-ink-soft">
                    {ach.label}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
