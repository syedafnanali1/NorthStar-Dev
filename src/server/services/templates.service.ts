import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { goalTemplates } from "@/drizzle/schema";

type GoalCategory = "health" | "finance" | "writing" | "body" | "mindset" | "custom";

export interface TemplateLibraryItem {
  id: string;
  title: string;
  category: GoalCategory;
  emoji: string;
  color: string;
  description: string;
  targetValue: number | null;
  unit: string | null;
  suggestedMilestones: string[];
  suggestedTasks: string[];
  motivationalPrompts: string[];
  timeframeDays: number | null;
  isOfficial: boolean;
  isCommunity: boolean;
  submissionStatus: "pending" | "approved" | "rejected";
  defaultWhy: string | null;
  defaultTasks: string[];
}

const CATEGORY_COLORS: Record<GoalCategory, string> = {
  health: "#6B8C7A",
  finance: "#5B7EA6",
  writing: "#C4963A",
  body: "#B5705B",
  mindset: "#7B6FA0",
  custom: "#C4963A",
};

const PACKS: Record<
  GoalCategory,
  Array<{
    title: string;
    emoji: string;
    targetValue: number | null;
    unit: string | null;
    timeframeDays: number;
    description: string;
    why: string;
  }>
> = {
  health: [
    { title: "Run a 5K", emoji: "🏃", targetValue: 5, unit: "km", timeframeDays: 56, description: "Build to a confident nonstop 5K run.", why: "I want stronger cardio and discipline." },
    { title: "Walk 10,000 steps daily", emoji: "🚶", targetValue: 70, unit: "days", timeframeDays: 70, description: "Hit your daily movement baseline consistently.", why: "I want more daily energy and momentum." },
    { title: "Cycle 200km in a month", emoji: "🚴", targetValue: 200, unit: "km", timeframeDays: 30, description: "Accumulate distance across consistent rides.", why: "I want endurance and healthier routines." },
    { title: "Swim 30 sessions", emoji: "🏊", targetValue: 30, unit: "sessions", timeframeDays: 90, description: "Build swimming consistency over a quarter.", why: "I want full-body conditioning and stamina." },
    { title: "Complete 12 yoga classes", emoji: "🧘", targetValue: 12, unit: "classes", timeframeDays: 60, description: "Improve mobility and calm through yoga.", why: "I want better mobility and stress control." },
    { title: "Reduce resting heart rate by 6 bpm", emoji: "❤️", targetValue: 6, unit: "bpm", timeframeDays: 120, description: "Improve cardiovascular fitness over time.", why: "I want measurable heart-health gains." },
    { title: "Train for a 10K", emoji: "🏅", targetValue: 10, unit: "km", timeframeDays: 90, description: "Progress from base miles to race readiness.", why: "I want to prove I can finish a race strong." },
    { title: "Mobility streak 45 days", emoji: "🤸", targetValue: 45, unit: "days", timeframeDays: 45, description: "Short daily mobility sessions for flexibility.", why: "I want to move pain-free every day." },
    { title: "Hike 20 trails", emoji: "🥾", targetValue: 20, unit: "trails", timeframeDays: 180, description: "Explore nature while building endurance.", why: "I want health gains and outdoor joy." },
    { title: "Drink 2L water daily", emoji: "💧", targetValue: 60, unit: "days", timeframeDays: 60, description: "Build a hydration habit that sticks.", why: "I want better focus and energy." },
  ],
  finance: [
    { title: "Save $10,000", emoji: "💰", targetValue: 10000, unit: "$", timeframeDays: 365, description: "Build a meaningful cash reserve.", why: "I want financial safety and options." },
    { title: "Emergency fund: 3 months", emoji: "🛟", targetValue: 3, unit: "months", timeframeDays: 240, description: "Fund core living expenses in reserve.", why: "I want to reduce money anxiety." },
    { title: "Pay off credit card debt", emoji: "📉", targetValue: 5000, unit: "$", timeframeDays: 180, description: "Eliminate high-interest debt steadily.", why: "I want to stop losing money to interest." },
    { title: "Invest $500 monthly", emoji: "📈", targetValue: 12, unit: "months", timeframeDays: 365, description: "Automate long-term wealth building.", why: "I want compounding to work for me." },
    { title: "No-spend challenge (30 days)", emoji: "🧾", targetValue: 30, unit: "days", timeframeDays: 30, description: "Cut non-essential spending for 1 month.", why: "I want to reset spending habits quickly." },
    { title: "Build travel fund $3K", emoji: "✈️", targetValue: 3000, unit: "$", timeframeDays: 180, description: "Save for a guilt-free trip.", why: "I want to enjoy travel without debt." },
    { title: "Increase income by $1,000/mo", emoji: "💼", targetValue: 1000, unit: "$", timeframeDays: 150, description: "Create new income streams or negotiate salary.", why: "I want to widen my monthly margin." },
    { title: "Track expenses daily", emoji: "📊", targetValue: 90, unit: "days", timeframeDays: 90, description: "Build awareness with consistent expense tracking.", why: "I want control and intentional spending." },
    { title: "Investing education sprint", emoji: "📚", targetValue: 20, unit: "hours", timeframeDays: 60, description: "Learn core investing fundamentals.", why: "I want smarter, evidence-based decisions." },
    { title: "Build house down payment", emoji: "🏠", targetValue: 20000, unit: "$", timeframeDays: 300, description: "Save aggressively for your next home.", why: "I want long-term stability for my family." },
  ],
  writing: [
    { title: "Write 50,000 words", emoji: "✍️", targetValue: 50000, unit: "words", timeframeDays: 90, description: "Draft a full long-form manuscript.", why: "I want to finally finish my book draft." },
    { title: "Publish 12 blog posts", emoji: "📝", targetValue: 12, unit: "posts", timeframeDays: 365, description: "Ship one quality post monthly.", why: "I want to grow audience and credibility." },
    { title: "Daily journal streak", emoji: "📔", targetValue: 60, unit: "days", timeframeDays: 60, description: "Reflect daily to sharpen clarity.", why: "I want clearer thinking and self-awareness." },
    { title: "Edit 200 pages", emoji: "📄", targetValue: 200, unit: "pages", timeframeDays: 120, description: "Turn draft chaos into polished prose.", why: "I want to bring my ideas to publishable quality." },
    { title: "Newsletter growth sprint", emoji: "📬", targetValue: 20, unit: "issues", timeframeDays: 140, description: "Ship regular newsletters with consistency.", why: "I want direct connection with readers." },
    { title: "Essay collection (10 essays)", emoji: "🖋️", targetValue: 10, unit: "essays", timeframeDays: 180, description: "Finish a cohesive essay collection.", why: "I want to refine my long-form voice." },
    { title: "Write 1,000 words/day", emoji: "⌨️", targetValue: 30, unit: "days", timeframeDays: 30, description: "Build output consistency over 30 days.", why: "I want to remove writer's hesitation." },
    { title: "Book proposal ready", emoji: "📘", targetValue: 1, unit: "proposal", timeframeDays: 45, description: "Complete and refine a market-ready proposal.", why: "I want to pitch my work confidently." },
    { title: "NaNoWriMo challenge", emoji: "🏁", targetValue: 50000, unit: "words", timeframeDays: 30, description: "Hit 50k words in one month.", why: "I want a finished draft, not perfect notes." },
    { title: "Read-to-write sprint", emoji: "📖", targetValue: 25, unit: "days", timeframeDays: 35, description: "Read and write in paired sessions.", why: "I want better craft through input and output." },
  ],
  body: [
    { title: "Lose 10 kg", emoji: "⚖️", targetValue: 10, unit: "kg", timeframeDays: 150, description: "Reduce weight sustainably with habits.", why: "I want better health and confidence." },
    { title: "Gain 4 kg muscle", emoji: "💪", targetValue: 4, unit: "kg", timeframeDays: 180, description: "Increase lean mass through progressive strength.", why: "I want to feel stronger in daily life." },
    { title: "Protein target daily", emoji: "🥩", targetValue: 60, unit: "days", timeframeDays: 60, description: "Hit your protein minimum every day.", why: "I want more consistent recovery and performance." },
    { title: "Strength train 4x/week", emoji: "🏋️", targetValue: 48, unit: "sessions", timeframeDays: 84, description: "Follow a structured lifting cadence.", why: "I want visible strength progress." },
    { title: "Body fat reduction", emoji: "📉", targetValue: 6, unit: "%", timeframeDays: 180, description: "Lower body fat through training and nutrition.", why: "I want healthier composition and stamina." },
    { title: "Meal prep consistency", emoji: "🥗", targetValue: 40, unit: "days", timeframeDays: 60, description: "Prep meals in advance to stay on plan.", why: "I want to remove friction from eating well." },
    { title: "30-day plank progression", emoji: "🧱", targetValue: 30, unit: "days", timeframeDays: 30, description: "Improve core endurance every day.", why: "I want a stronger and more stable core." },
    { title: "Complete 100 push-ups", emoji: "🔥", targetValue: 100, unit: "reps", timeframeDays: 90, description: "Progress to a 100-rep benchmark.", why: "I want measurable bodyweight strength." },
    { title: "Mobility + posture reset", emoji: "🧍", targetValue: 50, unit: "sessions", timeframeDays: 75, description: "Fix stiffness and improve posture habits.", why: "I want to move and sit pain-free." },
    { title: "Consistency cut phase", emoji: "🎯", targetValue: 12, unit: "weeks", timeframeDays: 84, description: "Execute a focused nutrition/training cut.", why: "I want disciplined execution with visible results." },
  ],
  mindset: [
    { title: "Meditate 10 min/day", emoji: "🧠", targetValue: 60, unit: "days", timeframeDays: 60, description: "Build a daily mindfulness baseline.", why: "I want calmer, clearer decision-making." },
    { title: "Morning routine streak", emoji: "🌅", targetValue: 45, unit: "days", timeframeDays: 45, description: "Lock in your first-hour routine daily.", why: "I want intentional starts to my day." },
    { title: "Read 12 books", emoji: "📚", targetValue: 12, unit: "books", timeframeDays: 365, description: "Read and reflect consistently all year.", why: "I want continuous personal growth." },
    { title: "Digital detox evenings", emoji: "📵", targetValue: 30, unit: "days", timeframeDays: 40, description: "Protect your evenings from digital noise.", why: "I want better focus and sleep." },
    { title: "Gratitude journaling", emoji: "🙏", targetValue: 50, unit: "days", timeframeDays: 50, description: "Capture daily gratitude and perspective.", why: "I want to improve emotional resilience." },
    { title: "Deep work practice", emoji: "⏳", targetValue: 40, unit: "sessions", timeframeDays: 60, description: "Schedule focused sessions with no context switching.", why: "I want high-quality output every week." },
    { title: "Public speaking confidence", emoji: "🎤", targetValue: 10, unit: "talks", timeframeDays: 180, description: "Practice and deliver speaking reps regularly.", why: "I want to communicate with confidence." },
    { title: "Mindful stress reset", emoji: "🌿", targetValue: 35, unit: "days", timeframeDays: 50, description: "Use breathwork and reflection to reduce stress.", why: "I want steadier emotional control." },
    { title: "Skill learning sprint", emoji: "🎓", targetValue: 100, unit: "hours", timeframeDays: 120, description: "Accumulate focused learning hours.", why: "I want to become highly competent in a new skill." },
    { title: "Confidence reps challenge", emoji: "✨", targetValue: 30, unit: "days", timeframeDays: 30, description: "Do one confidence-building action daily.", why: "I want to trust myself under pressure." },
  ],
  custom: [
    { title: "Launch a side project", emoji: "🚀", targetValue: 1, unit: "launch", timeframeDays: 90, description: "Plan, build, and launch your project.", why: "I want to ship, not just plan." },
    { title: "Learn conversational Spanish", emoji: "🗣️", targetValue: 120, unit: "hours", timeframeDays: 180, description: "Build speaking confidence through regular practice.", why: "I want real-world language confidence." },
    { title: "Declutter home system", emoji: "🧹", targetValue: 20, unit: "zones", timeframeDays: 50, description: "Declutter one area at a time until complete.", why: "I want a calmer environment and less friction." },
    { title: "Build portfolio site", emoji: "💻", targetValue: 1, unit: "site", timeframeDays: 45, description: "Create and publish a polished portfolio.", why: "I want stronger professional opportunities." },
    { title: "Family quality-time ritual", emoji: "❤️", targetValue: 40, unit: "days", timeframeDays: 60, description: "Create a consistent family connection habit.", why: "I want stronger relationships and presence." },
  ],
};

function buildDefaultMilestones(title: string, targetValue: number | null, unit: string | null) {
  if (!targetValue || targetValue <= 1) {
    return [
      `Define the first milestone for "${title}"`,
      "Complete your first momentum week",
      "Ship the final milestone",
    ];
  }
  return [25, 50, 75, 100].map((pct) => {
    const value = Math.round((targetValue * pct) / 100);
    return `Reach ${value.toLocaleString("en-US")}${unit ? ` ${unit}` : ""} (${pct}%)`;
  });
}

function buildDefaultTasks(title: string): string[] {
  return [
    `Take one measurable action for ${title}`,
    "Log progress immediately after completion",
    "Prepare tomorrow's next action before ending the day",
  ];
}

function makePrompt(title: string, why: string): string[] {
  return [
    `Remember why ${title} matters: ${why}`,
    "Small action > perfect plan. Ship today's step.",
    "Future-you benefits from today's consistency.",
  ];
}

const DEFAULT_TEMPLATE_LIBRARY: TemplateLibraryItem[] = Object.entries(PACKS).flatMap(
  ([category, entries]) =>
    entries.map((entry, index) => ({
      id: `official_${category}_${index + 1}`,
      title: entry.title,
      category: category as GoalCategory,
      emoji: entry.emoji,
      color: CATEGORY_COLORS[category as GoalCategory],
      description: entry.description,
      targetValue: entry.targetValue,
      unit: entry.unit,
      suggestedMilestones: buildDefaultMilestones(entry.title, entry.targetValue, entry.unit),
      suggestedTasks: buildDefaultTasks(entry.title),
      motivationalPrompts: makePrompt(entry.title, entry.why),
      timeframeDays: entry.timeframeDays,
      isOfficial: true,
      isCommunity: false,
      submissionStatus: "approved",
      defaultWhy: entry.why,
      defaultTasks: buildDefaultTasks(entry.title),
    }))
);

export const templatesService = {
  getDefaultTemplates(): TemplateLibraryItem[] {
    return DEFAULT_TEMPLATE_LIBRARY;
  },

  async listTemplates(options?: {
    categories?: GoalCategory[];
    includePendingForUserId?: string;
    limit?: number;
  }): Promise<TemplateLibraryItem[]> {
    const categories = options?.categories ?? [];
    const includePendingForUserId = options?.includePendingForUserId;
    const limit = Math.min(options?.limit ?? 200, 500);

    const official = categories.length
      ? DEFAULT_TEMPLATE_LIBRARY.filter((template) => categories.includes(template.category))
      : DEFAULT_TEMPLATE_LIBRARY;

    const dbRows = await db
      .select()
      .from(goalTemplates)
      .where(
        and(
          categories.length
            ? inArray(goalTemplates.category, categories)
            : sql`true`,
          or(
            eq(goalTemplates.submissionStatus, "approved"),
            includePendingForUserId
              ? and(
                  eq(goalTemplates.createdByUserId, includePendingForUserId),
                  eq(goalTemplates.submissionStatus, "pending")
                )
              : eq(goalTemplates.submissionStatus, "approved")
          )
        )
      )
      .orderBy(desc(goalTemplates.isOfficial), desc(goalTemplates.usageCount))
      .limit(limit);

    const dbMapped: TemplateLibraryItem[] = dbRows.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      emoji: row.emoji,
      color: row.color,
      description: row.description,
      targetValue: row.targetValue ?? null,
      unit: row.unit ?? null,
      suggestedMilestones: row.suggestedMilestones ?? [],
      suggestedTasks: row.suggestedTasks ?? [],
      motivationalPrompts: row.motivationalPrompts ?? [],
      timeframeDays: row.timeframeDays ?? null,
      isOfficial: row.isOfficial,
      isCommunity: row.isCommunity,
      submissionStatus: row.submissionStatus,
      defaultWhy: row.defaultWhy ?? null,
      defaultTasks: row.defaultTasks ?? [],
    }));

    const byTitle = new Map<string, TemplateLibraryItem>();
    for (const item of [...official, ...dbMapped]) {
      const key = `${item.category}:${item.title.toLowerCase()}`;
      if (!byTitle.has(key)) byTitle.set(key, item);
    }

    return [...byTitle.values()].slice(0, limit);
  },

  async submitCommunityTemplate(
    userId: string,
    input: {
      title: string;
      category: GoalCategory;
      emoji: string;
      description: string;
      targetValue?: number | null;
      unit?: string | null;
      suggestedMilestones?: string[];
      suggestedTasks?: string[];
      motivationalPrompts?: string[];
      timeframeDays?: number | null;
      defaultWhy?: string | null;
      defaultTasks?: string[];
    }
  ) {
    const [created] = await db
      .insert(goalTemplates)
      .values({
        title: input.title,
        category: input.category,
        emoji: input.emoji,
        color: CATEGORY_COLORS[input.category],
        description: input.description,
        targetValue: input.targetValue ?? null,
        unit: input.unit ?? null,
        suggestedMilestones: input.suggestedMilestones ?? [],
        suggestedTasks: input.suggestedTasks ?? [],
        motivationalPrompts: input.motivationalPrompts ?? [],
        timeframeDays: input.timeframeDays ?? null,
        isOfficial: false,
        isCommunity: true,
        submissionStatus: "pending",
        createdByUserId: userId,
        defaultWhy: input.defaultWhy ?? null,
        defaultTasks: input.defaultTasks ?? [],
      })
      .returning();

    if (!created) throw new Error("Failed to submit template");
    return created;
  },

  async markSubmissionStatus(
    templateId: string,
    status: "approved" | "rejected"
  ): Promise<void> {
    await db
      .update(goalTemplates)
      .set({ submissionStatus: status })
      .where(eq(goalTemplates.id, templateId));
  },

  async markTemplateUsed(templateId: string): Promise<void> {
    if (templateId.startsWith("official_")) return;
    await db
      .update(goalTemplates)
      .set({ usageCount: sql`${goalTemplates.usageCount} + 1` })
      .where(eq(goalTemplates.id, templateId));
  },
};
