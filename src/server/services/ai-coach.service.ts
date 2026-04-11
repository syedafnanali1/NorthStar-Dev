import { db } from "@/lib/db";
import { aiInsights, dailyLogs, goalTemplates, goals, progressEntries, users } from "@/drizzle/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { notificationsService } from "./notifications.service";

type GoalCategory = "health" | "finance" | "writing" | "body" | "mindset" | "custom";
const DAY_MS = 86_400_000;

const decomposeSchema = z.object({
  title: z.string().min(1).max(120),
  why: z.string().max(500).nullable().optional(),
  category: z.enum(["health", "finance", "writing", "body", "mindset", "custom"]),
  targetValue: z.number().positive().nullable(),
  unit: z.string().max(20).nullable(),
  suggestedMilestones: z.array(z.string().min(1).max(80)).min(1).max(5),
  suggestedTasks: z.array(z.string().min(1).max(120)).min(1).max(6),
  suggestedEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export type DecomposedGoalPlan = z.infer<typeof decomposeSchema>;
export interface CorrelationInsight { insight: string; confidence: number }
export interface SmartGoalSuggestion { title: string; category: GoalCategory; reason: string; confidence: number }
export interface PredictedCompletionData {
  etaDays: number;
  etaDate: string;
  daysAhead: number;
  daysToDeadline: number | null;
  projectedDelayDays: number;
  requiredDailyValue: number;
  currentDailyRate: number;
  paceRatio: number;
  onTrack: boolean;
  statusMessage: string;
}

interface GenerateNudgeOptions { daysSinceLastProgress?: number; createNotification?: boolean; persistInsight?: boolean }
interface PredictionInsightResult { prediction: PredictedCompletionData | null; created: boolean }
interface BatchResult { processed: number; created: number; failed: number }

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function round(v: number, d = 2) { const f = 10 ** d; return Math.round(v * f) / f; }
function avg(values: number[]) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }
function key(date: Date) { return date.toISOString().slice(0, 10); }
function norm(text: string) { return text.replace(/\s+/g, " ").trim(); }
function daysSince(date: Date) { return Math.max(0, Math.floor((Date.now() - date.getTime()) / DAY_MS)); }
function compact(str: string, max = 180) { const s = norm(str); return s.length <= max ? s : `${s.slice(0, max - 1)}...`; }
function parseJson(text: string): unknown { return JSON.parse(text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim()); }

function parseNum(raw: string, suffix?: string) {
  const base = Number.parseFloat(raw.replace(/,/g, ""));
  if (!Number.isFinite(base)) return 0;
  if (!suffix) return base;
  if (/k/i.test(suffix)) return base * 1_000;
  if (/m/i.test(suffix)) return base * 1_000_000;
  return base;
}

function inferCategory(description: string): GoalCategory {
  const t = description.toLowerCase();
  if (/save|debt|budget|money|invest|fund|mortgage|house/.test(t)) return "finance";
  if (/write|book|novel|blog|essay|word|page|publish/.test(t)) return "writing";
  if (/weight|muscle|fat|nutrition|calorie|protein|kg|lbs/.test(t)) return "body";
  if (/meditat|mindful|journal|focus|study|learn|habit|mindset/.test(t)) return "mindset";
  if (/run|marathon|5k|10k|workout|training|exercise|sleep/.test(t)) return "health";
  return "custom";
}

function inferTarget(description: string, category: GoalCategory) {
  const money = description.match(/\$\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*([kKmM])?/);
  if (money?.[1]) return { targetValue: parseNum(money[1], money[2]), unit: "$" as string | null };

  const metric = description.match(/([0-9][0-9,]*(?:\.[0-9]+)?)\s*(km|mi|miles?|words?|pages?|books?|kg|lbs?|days?|weeks?|hours?)/i);
  if (metric?.[1] && metric?.[2]) {
    const u = metric[2].toLowerCase();
    const map: Record<string, string> = { mile: "mi", miles: "mi", mi: "mi", km: "km", word: "words", words: "words", page: "pages", pages: "pages", book: "books", books: "books", kg: "kg", lb: "lbs", lbs: "lbs", day: "days", days: "days", week: "weeks", weeks: "weeks", hour: "hours", hours: "hours" };
    return { targetValue: parseNum(metric[1]), unit: map[u] ?? u };
  }

  const generic = description.match(/\b([0-9][0-9,]*(?:\.[0-9]+)?)\b/);
  if (!generic?.[1]) return { targetValue: null, unit: null };
  const n = parseNum(generic[1]);
  if (category === "finance") return { targetValue: n, unit: "$" };
  if (category === "writing") return { targetValue: n, unit: "words" };
  return { targetValue: n, unit: null };
}

function inferEndDate(description: string, now = new Date()) {
  const t = description.toLowerCase();
  const iso = t.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso?.[0]) return iso[0];

  const dur = t.match(/\bin\s+(\d{1,3})\s+(day|days|week|weeks|month|months|year|years)\b/);
  if (dur?.[1] && dur?.[2]) {
    const amount = Number.parseInt(dur[1], 10);
    const d = new Date(now);
    if (dur[2].startsWith("day")) d.setDate(d.getDate() + amount);
    else if (dur[2].startsWith("week")) d.setDate(d.getDate() + amount * 7);
    else if (dur[2].startsWith("month")) d.setMonth(d.getMonth() + amount);
    else d.setFullYear(d.getFullYear() + amount);
    return key(d);
  }

  if (/by christmas/.test(t)) {
    const year = now.getMonth() === 11 && now.getDate() > 25 ? now.getFullYear() + 1 : now.getFullYear();
    return `${year}-12-25`;
  }
  if (/by new year|by january 1/.test(t)) return `${now.getFullYear() + 1}-01-01`;
  return null;
}

function taskSuggestions(category: GoalCategory): string[] {
  const map: Record<GoalCategory, string[]> = {
    health: ["Complete one focused training session", "Prepare tomorrow's workout tonight", "Log one measurable health action", "Do 10 minutes of recovery"],
    finance: ["Automate a transfer into savings", "Track spending and cut one low-value expense", "Review balance for 5 minutes", "Take one debt-reducing action"],
    writing: ["Write for 25 focused minutes", "Capture one idea before noon", "Edit yesterday's draft", "Publish or share one small piece this week"],
    body: ["Hit your nutrition target for one meal block", "Complete your planned strength session", "Log protein and hydration", "Plan tomorrow's meals"],
    mindset: ["Do a 10-minute reflection", "Write your top 3 intentions", "Read or study for 20 minutes", "Capture one lesson from the day"],
    custom: ["Take one concrete action toward this goal", "Log measurable progress today", "Remove one blocker for tomorrow", "Review and adjust your next step"],
  };
  return map[category];
}

function fallbackDecompose(description: string): DecomposedGoalPlan {
  const category = inferCategory(description);
  const trimmed = norm(description.replace(/^goal\s*:\s*/i, "").replace(/^(i want to|my goal is to|i need to)\s+/i, "").replace(/[.!?]+$/, ""));
  const title = trimmed.length >= 3 && trimmed.length <= 120 ? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}` : "Build my next milestone";
  const whyMatch = description.match(/(?:because|so that)\s+(.+)$/i);
  const why = whyMatch?.[1] ? norm(whyMatch[1]).replace(/[.!?]+$/, "") : (/house|home/i.test(description) ? "To create long-term stability and peace of mind" : null);
  const { targetValue, unit } = inferTarget(description, category);
  const checkpoints = targetValue ? [0.25, 0.5, 0.75, 1].map((p) => `Reach ${Math.round(targetValue * p).toLocaleString("en-US")}${unit ? ` ${unit}` : ""} (${Math.round(p * 100)}%)`) : ["Define your baseline", "Complete your first full week", "Review progress", "Lock in the final push"];
  return { title, why, category, targetValue, unit, suggestedMilestones: checkpoints.slice(0, 5), suggestedTasks: taskSuggestions(category).slice(0, 4), suggestedEndDate: inferEndDate(description) };
}

async function callClaude(systemPrompt: string, userPrompt: string, maxTokens = 300): Promise<string> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey || apiKey === "sk-ant-your-key-here") throw new Error("ANTHROPIC_API_KEY is not configured");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] }),
  });
  if (!response.ok) throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`);
  const data = (await response.json()) as { content: Array<{ type: string; text: string }> };
  const text = data.content.find((item) => item.type === "text")?.text;
  if (!text) throw new Error("No text in Anthropic response");
  return text;
}

async function tryClaude(systemPrompt: string, userPrompt: string, maxTokens = 300): Promise<string | null> {
  try { return await callClaude(systemPrompt, userPrompt, maxTokens); }
  catch (error) { console.error("[ai-coach claude]", error); return null; }
}

export const aiCoachService = {
  async decomposeNaturalLanguageGoal(description: string): Promise<DecomposedGoalPlan> {
    const fallback = fallbackDecompose(description);
    const systemPrompt = [
      "You are a goal design expert.",
      "Return ONLY JSON with keys: title, why, category, targetValue, unit, suggestedMilestones, suggestedTasks, suggestedEndDate.",
      "category must be one of health|finance|writing|body|mindset|custom.",
      "suggestedMilestones 3-5 items. suggestedTasks 2-4 items.",
      "Date format must be YYYY-MM-DD or null.",
    ].join("\n");
    const userPrompt = `Today is ${key(new Date())}. Goal description: ${description}`;
    const model = await tryClaude(systemPrompt, userPrompt, 650);
    if (!model) return fallback;
    try {
      const parsed = decomposeSchema.parse(parseJson(model));
      return {
        ...parsed,
        title: norm(parsed.title).slice(0, 120),
        why: parsed.why ? norm(parsed.why).slice(0, 500) : null,
        suggestedMilestones: parsed.suggestedMilestones.length ? parsed.suggestedMilestones.map((m) => norm(m)).slice(0, 5) : fallback.suggestedMilestones,
        suggestedTasks: parsed.suggestedTasks.length ? parsed.suggestedTasks.map((t) => norm(t)).slice(0, 4) : fallback.suggestedTasks,
      };
    } catch {
      return fallback;
    }
  },

  async generateWeeklyReview(userId: string): Promise<string> {
    const since = new Date(Date.now() - 7 * DAY_MS);
    const [user, logs, userGoals, progress] = await Promise.all([
      db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1).then((rows) => rows[0] ?? null),
      db.select().from(dailyLogs).where(and(eq(dailyLogs.userId, userId), gte(dailyLogs.date, key(since)))).orderBy(desc(dailyLogs.date)),
      db.select({ id: goals.id, title: goals.title, unit: goals.unit, targetValue: goals.targetValue, currentValue: goals.currentValue, isCompleted: goals.isCompleted }).from(goals).where(and(eq(goals.userId, userId), eq(goals.isArchived, false))),
      db.select({ goalId: progressEntries.goalId, value: progressEntries.value }).from(progressEntries).where(and(eq(progressEntries.userId, userId), gte(progressEntries.loggedAt, since))),
    ]);

    const progressByGoal = new Map<string, number>();
    for (const row of progress) if (row.goalId) progressByGoal.set(row.goalId, (progressByGoal.get(row.goalId) ?? 0) + row.value);
    const top = [...progressByGoal.entries()].sort((a, b) => b[1] - a[1])[0];
    const topGoal = top ? userGoals.find((g) => g.id === top[0]) : null;
    const lowSleepDays = logs.filter((l) => l.sleep === "under_5" || l.sleep === "five_to_6").length;
    const lowMoodDays = logs.filter((l) => l.mood === "low" || l.mood === "anxious").length;
    const atRisk = userGoals.find((g) => !g.isCompleted && (progressByGoal.get(g.id) ?? 0) <= 0);

    const goalLines = userGoals.map((g) => `- ${g.title}: ${g.targetValue ? `${Math.round((g.currentValue / Math.max(g.targetValue, 0.0001)) * 100)}%` : "open target"}, week +${round(progressByGoal.get(g.id) ?? 0)}${g.unit ? ` ${g.unit}` : " units"}`).join("\n");
    const logLines = logs.map((l) => `- ${l.date}: mood=${l.mood ?? "n/a"}, sleep=${l.sleep ?? "n/a"}, tasks=${Array.isArray(l.completedTaskIds) ? l.completedTaskIds.length : 0}`).join("\n");

    const systemPrompt = "You are a warm, data-driven coach. Write <=170 words with exactly these section labels: Wins:, Patterns:, Focus Areas:. Include one concrete next action.";
    const userPrompt = [`User: ${user?.name ?? "there"}`, "Active goals:", goalLines || "- none", "Logs:", logLines || "- none", `Low sleep days: ${lowSleepDays}`, `Low mood days: ${lowMoodDays}`].join("\n");
    const model = await tryClaude(systemPrompt, userPrompt, 420);

    const fallback = [
      topGoal && top ? `Wins: You moved ${Math.round(top[1]).toLocaleString("en-US")}${topGoal.unit ? ` ${topGoal.unit}` : " units"} on ${topGoal.title} and checked in on ${logs.length} day(s).` : `Wins: You stayed active on ${logs.length} day(s) with ${progress.length} progress entries this week.`,
      lowSleepDays || lowMoodDays ? `Patterns: Lower energy appeared on ${lowSleepDays} low-sleep day(s) and ${lowMoodDays} low-mood day(s). Keep tomorrow lighter and focused.` : "Patterns: Your rhythm was stable this week. Protect your best check-in window.",
      atRisk ? `Focus Areas: Start tomorrow with one measurable action on ${atRisk.title}. Log it before noon.` : "Focus Areas: Pick one must-win action tomorrow and complete it before anything else.",
    ].join("\n");

    const content = model && model.trim().length ? norm(model).replace(/\s*(Wins:|Patterns:|Focus Areas:)\s*/g, "\n$1 ").trim() : fallback;
    await db.insert(aiInsights).values({ userId, type: "weekly_review", content, isRead: false });
    return content;
  },
  async generateNudge(userId: string, goalId: string, options?: GenerateNudgeOptions): Promise<string> {
    const cfg = { createNotification: false, persistInsight: true, ...options };
    const [goal] = await db
      .select({ id: goals.id, title: goals.title, why: goals.why, unit: goals.unit, targetValue: goals.targetValue, currentValue: goals.currentValue, endDate: goals.endDate, createdAt: goals.createdAt })
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);
    if (!goal) throw new Error("Goal not found");

    const [lastRow] = await db
      .select({ lastLoggedAt: sql<Date | null>`max(${progressEntries.loggedAt})` })
      .from(progressEntries)
      .where(and(eq(progressEntries.userId, userId), eq(progressEntries.goalId, goalId)));

    const idleDays = cfg.daysSinceLastProgress ?? daysSince(lastRow?.lastLoggedAt ?? goal.createdAt);
    const prediction = await this.getPredictedCompletion(goalId, userId);

    const systemPrompt = "You are a compassionate but direct accountability coach. Write one nudge under 90 words referencing the goal and why, ending with one concrete action for today.";
    const userPrompt = [
      `Goal: ${goal.title}`,
      `Why: ${goal.why ?? "not provided"}`,
      `Progress: ${round(goal.currentValue)}${goal.unit ? ` ${goal.unit}` : " units"} / ${goal.targetValue ?? "open"}`,
      `Days since last progress: ${idleDays}`,
      prediction ? `Pace: ${prediction.statusMessage}` : "Pace: not enough data",
    ].join("\n");
    const model = await tryClaude(systemPrompt, userPrompt, 220);

    const fallback = `${goal.title} matters because ${goal.why ?? "you chose it for a reason"}. It has been ${idleDays} day(s) since your last measurable move. Take 10 minutes today and log one concrete step.`;
    const content = norm(model ?? fallback);

    if (cfg.persistInsight) {
      await db.insert(aiInsights).values({ userId, type: "nudge", content, goalId, isRead: false });
    }
    if (cfg.createNotification) {
      await notificationsService.createNotification(userId, "weekly_review", `Coach nudge: ${goal.title}`, compact(content), `/goals/${goalId}`);
    }
    return content;
  },

  async detectCorrelations(userId: string): Promise<CorrelationInsight[]> {
    const since = new Date(Date.now() - 60 * DAY_MS);
    const [logs, progressRows] = await Promise.all([
      db.select().from(dailyLogs).where(and(eq(dailyLogs.userId, userId), gte(dailyLogs.date, key(since)))).orderBy(dailyLogs.date),
      db.select({ loggedAt: progressEntries.loggedAt, value: progressEntries.value, category: goals.category }).from(progressEntries).leftJoin(goals, eq(progressEntries.goalId, goals.id)).where(and(eq(progressEntries.userId, userId), gte(progressEntries.loggedAt, since))),
    ]);
    if (logs.length < 14) return [];

    const goodSleep = logs.filter((l) => l.sleep === "seven_to_8" || l.sleep === "over_8").map((l) => l.date);
    const lowSleep = logs.filter((l) => l.sleep === "under_5" || l.sleep === "five_to_6").map((l) => l.date);

    const byDate = new Map<string, { total: number; writing: number }>();
    for (const row of progressRows) {
      const d = key(row.loggedAt);
      const cur = byDate.get(d) ?? { total: 0, writing: 0 };
      cur.total += Math.max(0, row.value);
      if (row.category === "writing") cur.writing += Math.max(0, row.value);
      byDate.set(d, cur);
    }

    const insights: CorrelationInsight[] = [];
    if (goodSleep.length >= 5 && lowSleep.length >= 5) {
      const taskGood = avg(logs.filter((l) => goodSleep.includes(l.date)).map((l) => Array.isArray(l.completedTaskIds) ? l.completedTaskIds.length : 0));
      const taskLow = avg(logs.filter((l) => lowSleep.includes(l.date)).map((l) => Array.isArray(l.completedTaskIds) ? l.completedTaskIds.length : 0));
      if (taskGood > 0 && taskLow > 0) {
        const ratio = taskGood / Math.max(taskLow, 0.01);
        if (ratio >= 1.15) insights.push({ insight: `You complete about ${round(ratio, 1)}x more daily tasks on 7+ hour sleep days.`, confidence: clamp((ratio - 1) * 0.9 + 0.25, 0.31, 0.95) });
      }

      const writeGood = avg(goodSleep.map((d) => byDate.get(d)?.writing ?? 0));
      const writeLow = avg(lowSleep.map((d) => byDate.get(d)?.writing ?? 0));
      if (writeGood > 0 && writeLow > 0) {
        const ratio = writeGood / Math.max(writeLow, 0.01);
        if (ratio >= 1.2) insights.push({ insight: `You write ${round(ratio, 1)}x more on days with 7+ hours of sleep.`, confidence: clamp((ratio - 1) * 0.8 + 0.35, 0.33, 0.97) });
      }

      const progGood = avg(goodSleep.map((d) => byDate.get(d)?.total ?? 0));
      const progLow = avg(lowSleep.map((d) => byDate.get(d)?.total ?? 0));
      if (progGood > 0 && progLow > 0) {
        const ratio = progGood / Math.max(progLow, 0.01);
        if (ratio >= 1.2) insights.push({ insight: `Overall goal progress is ${round(ratio, 1)}x higher on your stronger-sleep days.`, confidence: clamp((ratio - 1) * 0.85 + 0.3, 0.31, 0.96) });
      }
    }

    const highMood = logs.filter((l) => l.mood === "energized" || l.mood === "focused").map((l) => l.date);
    const lowMood = logs.filter((l) => l.mood === "tired" || l.mood === "low" || l.mood === "anxious").map((l) => l.date);
    if (highMood.length >= 5 && lowMood.length >= 5) {
      const high = avg(highMood.map((d) => byDate.get(d)?.total ?? 0));
      const low = avg(lowMood.map((d) => byDate.get(d)?.total ?? 0));
      if (high > 0 && low > 0) {
        const ratio = high / Math.max(low, 0.01);
        if (ratio >= 1.15) insights.push({ insight: `On energized/focused days, you log about ${round(ratio, 1)}x more goal progress.`, confidence: clamp((ratio - 1) * 0.7 + 0.3, 0.31, 0.92) });
      }
    }

    return insights.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  },

  async getPredictedCompletion(goalId: string, userId: string): Promise<PredictedCompletionData | null> {
    const [goal] = await db
      .select({ id: goals.id, title: goals.title, targetValue: goals.targetValue, currentValue: goals.currentValue, unit: goals.unit, startDate: goals.startDate, endDate: goals.endDate, createdAt: goals.createdAt })
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      .limit(1);
    if (!goal || goal.targetValue == null || goal.targetValue <= 0) return null;

    const firstProgress = await db.select({ loggedAt: progressEntries.loggedAt }).from(progressEntries).where(and(eq(progressEntries.userId, userId), eq(progressEntries.goalId, goalId))).orderBy(progressEntries.loggedAt).limit(1).then((rows) => rows[0] ?? null);
    const start = goal.startDate ?? firstProgress?.loggedAt ?? goal.createdAt;
    const days = Math.max(1, Math.ceil((Date.now() - start.getTime()) / DAY_MS));
    const current = Math.max(0, goal.currentValue ?? 0);
    const remaining = Math.max(0, goal.targetValue - current);
    const currentRate = current / days;
    if (!Number.isFinite(currentRate) || currentRate <= 0) return null;

    const etaDays = Math.max(0, Math.ceil(remaining / currentRate));
    const etaDate = key(new Date(Date.now() + etaDays * DAY_MS));

    let daysToDeadline: number | null = null;
    let requiredRate = currentRate;
    let daysAhead = 0;
    let onTrack = true;
    let delay = 0;

    if (goal.endDate) {
      const raw = Math.ceil((goal.endDate.getTime() - Date.now()) / DAY_MS);
      daysToDeadline = raw;
      requiredRate = remaining / Math.max(1, raw);
      daysAhead = raw - etaDays;
      onTrack = daysAhead >= 0;
      delay = Math.max(0, -daysAhead);
    }

    const paceRatio = requiredRate > 0 ? currentRate / requiredRate : 1;
    const statusMessage = !goal.endDate
      ? `At this pace, ${goal.title} should finish in about ${etaDays} days (around ${etaDate}).`
      : onTrack
      ? (daysAhead > 0 ? `At this rate, ${goal.title} is projected to finish ${daysAhead} days early (around ${etaDate}).` : `At this rate, ${goal.title} is projected to finish on time (around ${etaDate}).`)
      : `At this rate, ${goal.title} will finish about ${delay} days late. Current pace is ${round(currentRate)}${goal.unit ? ` ${goal.unit}` : " units"}/day vs required ${round(requiredRate)}${goal.unit ? ` ${goal.unit}` : " units"}/day.`;

    return { etaDays, etaDate, daysAhead, daysToDeadline, projectedDelayDays: delay, requiredDailyValue: round(requiredRate), currentDailyRate: round(currentRate), paceRatio: round(paceRatio), onTrack, statusMessage };
  },

  async maybeCreatePredictionInsightForGoal(userId: string, goalId: string, options?: { cooldownHours?: number; force?: boolean; createNotification?: boolean }): Promise<PredictionInsightResult> {
    const prediction = await this.getPredictedCompletion(goalId, userId);
    if (!prediction) return { prediction: null, created: false };
    if (prediction.onTrack || prediction.projectedDelayDays < 3) return { prediction, created: false };

    const cooldownHours = options?.cooldownHours ?? 48;
    if (!options?.force) {
      const [existing] = await db.select({ id: aiInsights.id }).from(aiInsights).where(and(eq(aiInsights.userId, userId), eq(aiInsights.type, "prediction"), eq(aiInsights.goalId, goalId), gte(aiInsights.createdAt, new Date(Date.now() - cooldownHours * 3_600_000)))).limit(1);
      if (existing) return { prediction, created: false };
    }

    const [goal] = await db.select({ title: goals.title, why: goals.why, unit: goals.unit }).from(goals).where(and(eq(goals.id, goalId), eq(goals.userId, userId))).limit(1);
    if (!goal) return { prediction, created: false };

    const model = await tryClaude(
      "You are a direct but encouraging coach. Write one pace alert under 90 words with one concrete adjustment for today.",
      [`Goal: ${goal.title}`, `Why: ${goal.why ?? "not provided"}`, `Current pace: ${prediction.currentDailyRate}${goal.unit ? ` ${goal.unit}` : " units"}/day`, `Required pace: ${prediction.requiredDailyValue}${goal.unit ? ` ${goal.unit}` : " units"}/day`, `Projected delay: ${prediction.projectedDelayDays} days`, `ETA: ${prediction.etaDate}`].join("\n"),
      220
    );

    const content = norm(model ?? `${prediction.statusMessage} Choose one high-impact action today and log it before day-end.`);
    await db.insert(aiInsights).values({ userId, type: "prediction", content, goalId, isRead: false });
    if (options?.createNotification !== false) {
      await notificationsService.createNotification(userId, "weekly_review", `Pace alert: ${goal.title}`, compact(content), `/goals/${goalId}`);
    }
    return { prediction, created: true };
  },
  async runNudgeEngineForUser(userId: string): Promise<number> {
    const [openGoals, recentNudges, lastProgressRows] = await Promise.all([
      db.select({ id: goals.id, createdAt: goals.createdAt }).from(goals).where(and(eq(goals.userId, userId), eq(goals.isArchived, false), eq(goals.isCompleted, false))),
      db.select({ goalId: aiInsights.goalId }).from(aiInsights).where(and(eq(aiInsights.userId, userId), eq(aiInsights.type, "nudge"), gte(aiInsights.createdAt, new Date(Date.now() - 48 * 3_600_000)))),
      db.select({ goalId: progressEntries.goalId, lastLoggedAt: sql<Date | null>`max(${progressEntries.loggedAt})` }).from(progressEntries).where(and(eq(progressEntries.userId, userId), sql`${progressEntries.goalId} is not null`)).groupBy(progressEntries.goalId),
    ]);

    const cooledDown = new Set(recentNudges.map((r) => r.goalId).filter((id): id is string => typeof id === "string"));
    const lastByGoal = new Map<string, Date>();
    for (const row of lastProgressRows) if (row.goalId && row.lastLoggedAt) lastByGoal.set(row.goalId, row.lastLoggedAt);

    let created = 0;
    for (const goal of openGoals) {
      if (cooledDown.has(goal.id)) continue;
      const idle = daysSince(lastByGoal.get(goal.id) ?? goal.createdAt);
      if (idle < 3) continue;
      await this.generateNudge(userId, goal.id, { daysSinceLastProgress: idle, createNotification: true, persistInsight: true });
      created += 1;
      if (created >= 2) break;
    }
    return created;
  },

  async runNudgeEngineBatch(limit = 200): Promise<BatchResult> {
    const targets = await db.select({ id: users.id }).from(users).where(eq(users.aiCoachingEnabled, true)).limit(limit);
    let created = 0;
    let failed = 0;
    for (const target of targets) {
      try { created += await this.runNudgeEngineForUser(target.id); }
      catch (error) { failed += 1; console.error("[ai-coach nudge batch]", target.id, error); }
    }
    return { processed: targets.length, created, failed };
  },

  async runPredictiveAlertsForUser(userId: string): Promise<number> {
    const candidates = await db.select({ id: goals.id }).from(goals).where(and(eq(goals.userId, userId), eq(goals.isArchived, false), eq(goals.isCompleted, false), sql`${goals.targetValue} is not null`, sql`${goals.endDate} is not null`));
    let created = 0;
    for (const goal of candidates) {
      const res = await this.maybeCreatePredictionInsightForGoal(userId, goal.id, { createNotification: true, cooldownHours: 48 });
      if (res.created) created += 1;
      if (created >= 1) break;
    }
    return created;
  },

  async runPredictiveAlertsBatch(limit = 200): Promise<BatchResult> {
    const targets = await db.select({ id: users.id }).from(users).where(eq(users.aiCoachingEnabled, true)).limit(limit);
    let created = 0;
    let failed = 0;
    for (const target of targets) {
      try { created += await this.runPredictiveAlertsForUser(target.id); }
      catch (error) { failed += 1; console.error("[ai-coach prediction batch]", target.id, error); }
    }
    return { processed: targets.length, created, failed };
  },

  async getSmartGoalSuggestions(userId: string, limit = 3): Promise<SmartGoalSuggestion[]> {
    const since = new Date(Date.now() - 540 * DAY_MS);
    const [userGoals, allGoals, templates] = await Promise.all([
      db.select({ title: goals.title, category: goals.category, isCompleted: goals.isCompleted, completedAt: goals.completedAt, createdAt: goals.createdAt }).from(goals).where(eq(goals.userId, userId)),
      db.select({ userId: goals.userId, title: goals.title, category: goals.category, completedAt: goals.completedAt, createdAt: goals.createdAt }).from(goals).where(gte(goals.createdAt, since)),
      db.select({ title: goalTemplates.title, category: goalTemplates.category }).from(goalTemplates),
    ]);

    const completed = userGoals.filter((g) => g.isCompleted && g.completedAt).sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));
    if (completed.length === 0) {
      const c = userGoals[0]?.category ?? "custom";
      const next = c === "health" ? "body" : c === "finance" ? "mindset" : c === "writing" ? "mindset" : c === "body" ? "health" : "health";
      const title = templates.find((t) => t.category === next)?.title ?? (next === "body" ? "Add a daily nutrition consistency goal" : "Build a 10-minute daily reflection habit");
      return [{ title, category: next, reason: "Based on your current goals, a supportive follow-on goal is your best next move.", confidence: 0.45 }];
    }

    const byUser = new Map<string, Array<{ title: string; category: GoalCategory; completedAt: Date | null; createdAt: Date }>>();
    for (const row of allGoals) {
      const list = byUser.get(row.userId) ?? [];
      list.push({ title: row.title, category: row.category, completedAt: row.completedAt, createdAt: row.createdAt });
      byUser.set(row.userId, list);
    }

    const transitions = new Map<string, Map<string, { count: number; category: GoalCategory }>>();
    for (const timeline of byUser.values()) {
      timeline.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      for (const source of timeline) {
        if (!source.completedAt) continue;
        const next = timeline.find((candidate) => candidate.createdAt.getTime() > source.completedAt!.getTime());
        if (!next) continue;
        const from = /marathon|half marathon|10k|5k|race|run\b/i.test(source.title) ? "running_marathon" : `${source.category}_general`;
        const to = /nutrition|protein|calorie|meal|hydration|water/i.test(next.title) ? "nutrition" : `${next.category}_general`;
        const map = transitions.get(from) ?? new Map<string, { count: number; category: GoalCategory }>();
        const cur = map.get(to);
        map.set(to, { count: (cur?.count ?? 0) + 1, category: to === "nutrition" ? "body" : next.category });
        transitions.set(from, map);
      }
    }

    const source = completed[0]!;
    const sourceKey = /marathon|half marathon|10k|5k|race|run\b/i.test(source.title) ? "running_marathon" : `${source.category}_general`;
    const candidates = transitions.get(sourceKey);
    const ranked = candidates ? Array.from(candidates.entries()).sort((a, b) => b[1].count - a[1].count) : [];

    const existingTitles = new Set(userGoals.map((g) => g.title.toLowerCase()));
    const suggestions: SmartGoalSuggestion[] = [];

    if (/marathon|half marathon|10k|5k|race|run\b/i.test(source.title)) {
      const nutritionTitle = templates.find((t) => t.category === "body" && !existingTitles.has(t.title.toLowerCase()))?.title ?? "Add a daily nutrition consistency goal";
      suggestions.push({ title: nutritionTitle, category: "body", reason: "Users who complete a marathon typically add a nutrition goal next.", confidence: 0.82 });
    }

    for (const [cluster, meta] of ranked) {
      const category = meta.category;
      const title = templates.find((t) => t.category === category && !existingTitles.has(t.title.toLowerCase()))?.title ?? (category === "mindset" ? "Build a 10-minute daily reflection habit" : category === "health" ? "Build a recovery and consistency routine" : category === "finance" ? "Strengthen your monthly savings system" : category === "writing" ? "Start a weekly publishing streak" : category === "body" ? "Add a daily nutrition consistency goal" : "Create a next-level momentum goal");
      if (existingTitles.has(title.toLowerCase()) || suggestions.some((s) => s.title.toLowerCase() === title.toLowerCase())) continue;
      const label = cluster.replace(/_general$/, "").replace(/_/g, " ");
      suggestions.push({ title, category, reason: `Users with momentum in ${sourceKey.replace(/_general$/, "").replace(/_/g, " ")} often move next into ${label}.`, confidence: clamp(meta.count / 5 + 0.35, 0.35, 0.95) });
      if (suggestions.length >= limit) break;
    }

    return suggestions.slice(0, limit);
  },

  async createSmartSuggestionInsight(userId: string, sourceGoalId?: string): Promise<SmartGoalSuggestion | null> {
    const [recent] = await db.select({ id: aiInsights.id }).from(aiInsights).where(and(eq(aiInsights.userId, userId), eq(aiInsights.type, "suggestion"), gte(aiInsights.createdAt, new Date(Date.now() - 5 * DAY_MS)))).limit(1);
    if (recent) return null;

    const [top] = await this.getSmartGoalSuggestions(userId, 1);
    if (!top) return null;

    const content = `${top.reason} Try this next: ${top.title}.`;
    await db.insert(aiInsights).values({ userId, type: "suggestion", content, goalId: sourceGoalId ?? null, isRead: false });
    await notificationsService.createNotification(userId, "weekly_review", "AI coach suggestion", compact(content), "/goals/new");
    return top;
  },

  async getLatestUnread(userId: string) {
    const [insight] = await db.select().from(aiInsights).where(and(eq(aiInsights.userId, userId), eq(aiInsights.isRead, false))).orderBy(desc(aiInsights.createdAt)).limit(1);
    return insight ?? null;
  },

  async markRead(insightId: string, userId: string): Promise<void> {
    await db.update(aiInsights).set({ isRead: true }).where(and(eq(aiInsights.id, insightId), eq(aiInsights.userId, userId)));
  },
};
