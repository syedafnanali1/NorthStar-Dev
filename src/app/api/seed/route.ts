// src/app/api/seed/route.ts
// Dev-only seed endpoint — creates test users with realistic data.
// Protected by SEED_SECRET env var (or CRON_SECRET as fallback).
// Usage: POST /api/seed   (or GET for convenience)

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  users,
  goals,
  dailyLogs,
  circleConnections,
  userAchievements,
  groupMembers,
  groups,
} from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import type { NextRequest } from "next/server";

// ── Auth guard ──────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env["SEED_SECRET"] ?? process.env["CRON_SECRET"];
  if (!secret) return process.env["NODE_ENV"] === "development";
  const header = req.headers.get("x-seed-secret");
  const query = req.nextUrl.searchParams.get("secret");
  return header === secret || query === secret;
}

// ── Test users ───────────────────────────────────────────────────────────────

const TEST_USERS = [
  {
    id: "usr_test_alice_001",
    name: "Alice Chen",
    email: "alice@northstar.test",
    username: "alice_chen",
    bio: "Product designer & marathon runner. Building a life I'm proud of, one day at a time.",
    location: "San Francisco, CA",
    jobTitle: "Product Designer",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=alice&backgroundColor=b6e3f4",
    currentStreak: 18,
    longestStreak: 31,
    totalGoalsCompleted: 7,
    xpPoints: 3400,
    level: 6,
    momentumScore: 82,
  },
  {
    id: "usr_test_bob_002",
    name: "Bob Martinez",
    email: "bob@northstar.test",
    username: "bob_martinez",
    bio: "Software engineer turned fitness enthusiast. Obsessed with systems thinking and cold showers.",
    location: "Austin, TX",
    jobTitle: "Software Engineer",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=bob&backgroundColor=c0aede",
    currentStreak: 42,
    longestStreak: 60,
    totalGoalsCompleted: 12,
    xpPoints: 7200,
    level: 10,
    momentumScore: 94,
  },
  {
    id: "usr_test_charlie_003",
    name: "Charlie Park",
    email: "charlie@northstar.test",
    username: "charlie_park",
    bio: "Writer, reader, and amateur chef. Trying to write a novel and run a 5K by December.",
    location: "New York, NY",
    jobTitle: "Content Writer",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=charlie&backgroundColor=d1f4d9",
    currentStreak: 7,
    longestStreak: 14,
    totalGoalsCompleted: 3,
    xpPoints: 1200,
    level: 3,
    momentumScore: 61,
  },
  {
    id: "usr_test_diana_004",
    name: "Diana Thompson",
    email: "diana@northstar.test",
    username: "diana_thompson",
    bio: "Yoga instructor & mindfulness coach. Helping people slow down to go further.",
    location: "Portland, OR",
    jobTitle: "Yoga Instructor",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=diana&backgroundColor=ffd5dc",
    currentStreak: 90,
    longestStreak: 120,
    totalGoalsCompleted: 24,
    xpPoints: 15600,
    level: 18,
    momentumScore: 98,
  },
  {
    id: "usr_test_evan_005",
    name: "Evan Williams",
    email: "evan@northstar.test",
    username: "evan_williams",
    bio: "Finance guy by day, guitar player by night. Working on financial freedom and musical goals.",
    location: "Chicago, IL",
    jobTitle: "Financial Analyst",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=evan&backgroundColor=ffefd5",
    currentStreak: 25,
    longestStreak: 45,
    totalGoalsCompleted: 9,
    xpPoints: 4800,
    level: 8,
    momentumScore: 76,
  },
  {
    id: "usr_test_priya_006",
    name: "Priya Patel",
    email: "priya@northstar.test",
    username: "priya_patel",
    bio: "Startup founder & health nut. Balancing building a company with building a better me.",
    location: "Seattle, WA",
    jobTitle: "CEO & Founder",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=priya&backgroundColor=ffdfba",
    currentStreak: 55,
    longestStreak: 80,
    totalGoalsCompleted: 16,
    xpPoints: 9200,
    level: 13,
    momentumScore: 90,
  },
];

const GOALS_TEMPLATES = [
  { title: "Run 5K every morning", category: "body" as const, targetValue: 5, unit: "km" },
  { title: "Save $500 per month", category: "finance" as const, targetValue: 500, unit: "dollars" },
  { title: "Read 30 pages daily", category: "mindset" as const, targetValue: 30, unit: "pages" },
  { title: "Meditate 10 minutes", category: "health" as const, targetValue: 10, unit: "minutes" },
  { title: "Write 500 words", category: "writing" as const, targetValue: 500, unit: "words" },
  { title: "Go to bed by 10pm", category: "health" as const, targetValue: 1, unit: "days" },
  { title: "Cold shower every day", category: "health" as const, targetValue: 1, unit: "days" },
  { title: "Build side project 1hr/day", category: "custom" as const, targetValue: 1, unit: "hours" },
];

const ACHIEVEMENTS = [
  "first_goal_created",
  "first_checkin",
  "streak_7",
  "streak_30",
  "circle_friend_added",
  "goal_completed",
  "early_bird",
];

function randomDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function deadlineDate(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handler(req);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handler(req);
}

async function handler(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized. Pass ?secret=<SEED_SECRET>" }, { status: 401 });
  }

  const passwordHash = await bcrypt.hash("NorthStar2025!", 10);
  const results: string[] = [];

  try {
    // ── 1. Upsert test users ──────────────────────────────────────────────────
    for (const u of TEST_USERS) {
      await db
        .insert(users)
        .values({
          id: u.id,
          name: u.name,
          email: u.email,
          username: u.username,
          bio: u.bio,
          location: u.location,
          jobTitle: u.jobTitle,
          image: u.image,
          emailVerified: new Date(),
          passwordHash,
          currentStreak: u.currentStreak,
          longestStreak: u.longestStreak,
          totalGoalsCompleted: u.totalGoalsCompleted,
          xpPoints: u.xpPoints,
          level: u.level,
          momentumScore: u.momentumScore,
          northStarScore: Math.round(u.momentumScore * 10),
          hasCompletedOnboarding: true,
          lastActiveAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [users.email],
          set: {
            name: u.name,
            username: u.username,
            bio: u.bio,
            location: u.location,
            jobTitle: u.jobTitle,
            image: u.image,
            currentStreak: u.currentStreak,
            momentumScore: u.momentumScore,
            passwordHash,
          },
        });
      results.push(`✅ User: ${u.name} (${u.email})`);
    }

    // ── 2. Create goals for each user ─────────────────────────────────────────
    for (let i = 0; i < TEST_USERS.length; i++) {
      const u = TEST_USERS[i]!;
      const goalCount = 2 + (i % 3); // 2–4 goals per user
      for (let g = 0; g < goalCount; g++) {
        const tmpl = GOALS_TEMPLATES[(i * 3 + g) % GOALS_TEMPLATES.length]!;
        const daysLeft = 30 + (g * 30);
        const progress = 0.2 + (i * 0.15) + (g * 0.05);

        const isCompleted = progress >= 0.95;
        await db
          .insert(goals)
          .values({
            userId: u.id,
            title: tmpl.title,
            category: tmpl.category,
            targetValue: tmpl.targetValue,
            currentValue: Math.round(tmpl.targetValue * Math.min(progress, 0.95)),
            unit: tmpl.unit,
            endDate: deadlineDate(daysLeft),
            isCompleted,
            completedAt: isCompleted ? new Date() : undefined,
            isPublic: i % 2 === 0,
          })
          .onConflictDoNothing();
      }
      results.push(`  📎 Goals seeded for ${u.name}`);
    }

    // ── 3. Create daily logs (last 30 days of check-ins) ──────────────────────
    const moods = ["energized", "good", "neutral", "tired", "low"] as const;
    const sleepLevels = ["over_8", "seven_to_8", "six_to_7", "five_to_6"] as const;

    for (const u of TEST_USERS) {
      const checkinDays = u.currentStreak;
      for (let day = 0; day < Math.min(checkinDays, 30); day++) {
        const dateStr = randomDate(day);
        await db
          .insert(dailyLogs)
          .values({
            userId: u.id,
            date: dateStr,
            mood: moods[day % moods.length],
            sleep: sleepLevels[day % sleepLevels.length],
            completedTaskIds: [],
            dailyIntentions: [],
          })
          .onConflictDoNothing();
      }
      results.push(`  📅 Daily logs seeded for ${u.name}`);
    }

    // ── 4. Create circle connections ──────────────────────────────────────────
    const connections = [
      { a: TEST_USERS[0]!.id, b: TEST_USERS[1]!.id, status: "accepted" as const },
      { a: TEST_USERS[0]!.id, b: TEST_USERS[2]!.id, status: "accepted" as const },
      { a: TEST_USERS[1]!.id, b: TEST_USERS[3]!.id, status: "accepted" as const },
      { a: TEST_USERS[2]!.id, b: TEST_USERS[4]!.id, status: "accepted" as const },
      { a: TEST_USERS[3]!.id, b: TEST_USERS[5]!.id, status: "accepted" as const },
      { a: TEST_USERS[1]!.id, b: TEST_USERS[5]!.id, status: "accepted" as const },
      // Pending request from Priya to Charlie (for demo)
      { a: TEST_USERS[5]!.id, b: TEST_USERS[2]!.id, status: "pending" as const },
    ];

    for (const conn of connections) {
      await db
        .insert(circleConnections)
        .values({
          id: `conn_test_${conn.a.slice(-6)}_${conn.b.slice(-6)}`,
          requesterId: conn.a,
          receiverId: conn.b,
          status: conn.status,
        })
        .onConflictDoNothing();
    }
    results.push(`  🔗 Circle connections created`);

    // ── 5. Achievements ───────────────────────────────────────────────────────
    for (let i = 0; i < TEST_USERS.length; i++) {
      const u = TEST_USERS[i]!;
      const earnCount = 2 + (i % 4); // vary per user
      for (let a = 0; a < earnCount; a++) {
        const key = ACHIEVEMENTS[(i + a) % ACHIEVEMENTS.length]!;
        await db
          .insert(userAchievements)
          .values({
            id: `ach_test_${u.id.slice(-6)}_${a}`,
            userId: u.id,
            achievementKey: key,
          })
          .onConflictDoNothing();
      }
    }
    results.push(`  🏆 Achievements seeded`);

    return NextResponse.json({
      ok: true,
      message: "Seed complete! All test users can log in with password: NorthStar2025!",
      users: TEST_USERS.map((u) => ({ email: u.email, name: u.name, password: "NorthStar2025!" })),
      results,
    });
  } catch (err) {
    console.error("[seed]", err);
    return NextResponse.json(
      { error: String(err), results },
      { status: 500 }
    );
  }
}
