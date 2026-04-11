import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { goals, progressEntries } from "@/drizzle/schema";

const VALUE_RE =
  /(\d+(?:\.\d+)?)\s*(km|kilometers?|miles?|words?|steps?|minutes?|mins?|hours?|hrs?)/i;

function normalizeUnit(unit: string): string {
  const raw = unit.toLowerCase();
  if (raw.startsWith("km") || raw.startsWith("kilo")) return "km";
  if (raw.startsWith("mile")) return "miles";
  if (raw.startsWith("word")) return "words";
  if (raw.startsWith("step")) return "steps";
  if (raw.startsWith("min")) return "minutes";
  if (raw.startsWith("hour") || raw.startsWith("hr")) return "hours";
  return raw;
}

function unitMatch(goalUnit: string | null, parsedUnit: string): boolean {
  if (!goalUnit) return false;
  const unit = goalUnit.toLowerCase();
  if (parsedUnit === "km") return unit.includes("km") || unit.includes("mile");
  if (parsedUnit === "miles") return unit.includes("mile") || unit.includes("km");
  if (parsedUnit === "words") return unit.includes("word");
  if (parsedUnit === "steps") return unit.includes("step");
  if (parsedUnit === "minutes") return unit.includes("minute");
  if (parsedUnit === "hours") return unit.includes("hour");
  return unit.includes(parsedUnit);
}

export const naturalLogService = {
  async parseForUser(userId: string, textOrTranscript: string) {
    const text = textOrTranscript.trim();
    if (!text) throw new Error("Input text is required.");

    const metric = VALUE_RE.exec(text);
    const value = metric ? Number.parseFloat(metric[1] ?? "0") : null;
    const parsedUnit = metric ? normalizeUnit(metric[2] ?? "") : null;

    const activeGoals = await db
      .select({
        id: goals.id,
        title: goals.title,
        unit: goals.unit,
        currentValue: goals.currentValue,
        targetValue: goals.targetValue,
        isCompleted: goals.isCompleted,
      })
      .from(goals)
      .where(
        and(
          eq(goals.userId, userId),
          eq(goals.isArchived, false),
          eq(goals.isCompleted, false)
        )
      );

    let best:
      | (typeof activeGoals)[number]
      | null = null;
    let bestScore = -1;
    for (const goal of activeGoals) {
      let score = 0;
      if (parsedUnit && unitMatch(goal.unit, parsedUnit)) score += 6;
      const titleLc = goal.title.toLowerCase();
      for (const token of text.toLowerCase().split(/\s+/)) {
        if (token.length >= 4 && titleLc.includes(token)) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = goal;
      }
    }

    const painSignals: string[] = [];
    if (/knee pain|ankle pain|back pain|pain/i.test(text)) painSignals.push("pain");
    if (/tired|exhausted|fatigue/i.test(text)) painSignals.push("fatigue");

    return {
      input: text,
      parsed: {
        value,
        unit: parsedUnit,
      },
      suggestion: best
        ? {
            goalId: best.id,
            goalTitle: best.title,
            value: value ?? 1,
            reason: parsedUnit
              ? `Matched by unit (${parsedUnit}) and context.`
              : "Matched by context keywords.",
          }
        : null,
      healthSignals: painSignals,
      note: text,
    };
  },

  async applyParsedLog(input: {
    userId: string;
    goalId: string;
    value: number;
    note?: string;
  }) {
    if (input.value <= 0) throw new Error("Progress value must be positive.");

    const [goal] = await db
      .select({
        id: goals.id,
        currentValue: goals.currentValue,
        targetValue: goals.targetValue,
      })
      .from(goals)
      .where(and(eq(goals.id, input.goalId), eq(goals.userId, input.userId)))
      .limit(1);

    if (!goal) throw new Error("Goal not found.");

    await db.insert(progressEntries).values({
      userId: input.userId,
      goalId: input.goalId,
      value: input.value,
      note: input.note ?? "Natural-language log",
    });

    const currentValue = goal.currentValue + input.value;
    const completed = goal.targetValue ? currentValue >= goal.targetValue : false;

    await db
      .update(goals)
      .set({
        currentValue,
        isCompleted: completed,
        completedAt: completed ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(goals.id, goal.id));

    return { goalId: goal.id, currentValue, completed };
  },
};

