const DAY_MS = 86_400_000;

export type GoalCategory =
  | "health"
  | "finance"
  | "writing"
  | "body"
  | "mindset"
  | "custom";

export type GoalIntent = "reading" | "weight_loss" | "money_saving" | "generic";
export type MoneyCadence = "daily" | "weekly" | "monthly" | "every_other_day" | "custom";

export interface GoalSmartSuggestion {
  intent: GoalIntent;
  category: GoalCategory;
  unit: string | null;
  unitOptions: string[];
  quantityLabel: string;
  timeframeLabel: string;
  cadence: MoneyCadence;
  cadenceOptions: Array<{ value: MoneyCadence; label: string }>;
}

export interface GoalTaskDraft {
  text: string;
  incrementValue?: number | string | null;
}

export interface PreparedGoalTask {
  text: string;
  incrementValue?: number;
}

export interface DecomposedGoalOutput {
  title: string;
  why: string | null;
  category: GoalCategory;
  targetValue: number | null;
  unit: string | null;
  suggestedMilestones: string[];
  suggestedTasks: string[];
  suggestedEndDate: string | null;
}

function toLower(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function cap(text: string): string {
  const t = text.trim();
  if (!t) return "";
  return `${t.slice(0, 1).toUpperCase()}${t.slice(1)}`;
}

function parsePositiveNumber(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function inferDateFromText(text: string, now = new Date()): string | null {
  const lower = toLower(text);
  const iso = lower.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso?.[0]) return iso[0];

  const inDuration = lower.match(/\bin\s+(\d{1,3})\s+(day|days|week|weeks|month|months|year|years)\b/);
  if (inDuration?.[1] && inDuration[2]) {
    const amount = Number.parseInt(inDuration[1], 10);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const date = new Date(now);
    if (inDuration[2].startsWith("day")) date.setDate(date.getDate() + amount);
    else if (inDuration[2].startsWith("week")) date.setDate(date.getDate() + amount * 7);
    else if (inDuration[2].startsWith("month")) date.setMonth(date.getMonth() + amount);
    else date.setFullYear(date.getFullYear() + amount);
    return toIsoDate(date);
  }

  return null;
}

function buildFallbackTitle(description: string): string {
  const cleaned = description
    .trim()
    .replace(/^goal\s*:\s*/i, "")
    .replace(/^(i want to|my goal is to|i need to)\s+/i, "")
    .replace(/[.!?]+$/, "");
  if (cleaned.length >= 3) return cap(cleaned).slice(0, 120);
  return "Build my next milestone";
}

function buildMilestones(targetValue: number | null, unit: string | null): string[] {
  if (!targetValue || targetValue <= 0) {
    return [
      "Define your baseline",
      "Complete your first full week",
      "Review and adjust your plan",
      "Lock in your final push",
    ];
  }

  return [0.25, 0.5, 0.75, 1].map((ratio) => {
    const value = Math.max(1, Math.round(targetValue * ratio));
    return `Reach ${value.toLocaleString("en-US")}${unit ? ` ${unit}` : ""} (${Math.round(ratio * 100)}%)`;
  });
}

function cadenceDays(cadence: MoneyCadence): number | null {
  switch (cadence) {
    case "daily":
      return 1;
    case "every_other_day":
      return 2;
    case "weekly":
      return 7;
    case "monthly":
      return 30;
    default:
      return null;
  }
}

function cadenceLabel(cadence: MoneyCadence): string {
  switch (cadence) {
    case "daily":
      return "per day";
    case "every_other_day":
      return "every other day";
    case "weekly":
      return "per week";
    case "monthly":
      return "per month";
    default:
      return "per period";
  }
}

function normalizeCurrencyUnit(unit: string | null | undefined): string {
  const normalized = (unit ?? "").trim().toUpperCase();
  if (!normalized || normalized === "USD") return "$";
  if (normalized === "EUR") return "EUR";
  if (normalized === "GBP") return "GBP";
  if (normalized === "CAD") return "CAD";
  if (normalized === "AUD") return "AUD";
  if (normalized === "$") return "$";
  return normalized.slice(0, 10);
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
}

export function inferGoalSmartSuggestion(
  title: string,
  why = "",
  fallbackCategory?: GoalCategory | null
): GoalSmartSuggestion {
  const text = toLower(`${title} ${why}`);
  const reading = /\b(read|reading|book|books|page|pages|chapter|chapters|novel|kindle|audiobook)\b/.test(text);
  const money = /\b(save|saving|money|budget|debt|invest|income|cash|fund|dollar|usd|finance)\b/.test(text);
  const weightMarkers = /\b(weight|lbs?|lb|kg|kilogram|fat|body fat|bodyweight)\b/.test(text);
  const weightLossVerbs = /\b(lose|drop|reduce|cut|shed)\b/.test(text);
  const weightLoss = /\blose weight\b/.test(text) || (weightMarkers && weightLossVerbs);

  if (money) {
    return {
      intent: "money_saving",
      category: "finance",
      unit: "$",
      unitOptions: ["$", "USD", "EUR", "GBP", "CAD", "AUD"],
      quantityLabel: "Amount to save",
      timeframeLabel: "Choose cadence and optional deadline",
      cadence: "daily",
      cadenceOptions: [
        { value: "daily", label: "Per day" },
        { value: "every_other_day", label: "Every other day" },
        { value: "weekly", label: "Per week" },
        { value: "monthly", label: "Per month" },
        { value: "custom", label: "Custom" },
      ],
    };
  }

  if (weightLoss) {
    const prefersKg = /\bkg|kilogram/.test(text);
    return {
      intent: "weight_loss",
      category: "body",
      unit: prefersKg ? "kg" : "lb",
      unitOptions: ["lb", "kg"],
      quantityLabel: "Weight to lose",
      timeframeLabel: "Target date",
      cadence: "daily",
      cadenceOptions: [{ value: "daily", label: "Per day" }],
    };
  }

  if (reading) {
    return {
      intent: "reading",
      category: fallbackCategory ?? "mindset",
      unit: "pages",
      unitOptions: ["pages"],
      quantityLabel: "Pages per completed intention",
      timeframeLabel: "Optional target date",
      cadence: "daily",
      cadenceOptions: [{ value: "daily", label: "Per day" }],
    };
  }

  const fallback = fallbackCategory ?? "custom";
  return {
    intent: "generic",
    category: fallback,
    unit:
      fallback === "finance"
        ? "$"
        : fallback === "body"
        ? "kg"
        : fallback === "writing"
        ? "words"
        : null,
    unitOptions: [],
    quantityLabel: "Progress per completion",
    timeframeLabel: "Optional target date",
    cadence: "daily",
    cadenceOptions: [{ value: "daily", label: "Per day" }],
  };
}

export function computeCadenceTarget(params: {
  amount: number;
  cadence: MoneyCadence;
  startDate?: string | null;
  endDate?: string | null;
}): number | null {
  if (!Number.isFinite(params.amount) || params.amount <= 0) return null;
  const intervalDays = cadenceDays(params.cadence);
  if (!intervalDays) return round3(params.amount);

  const start = parseIsoDate(params.startDate) ?? new Date();
  const end = parseIsoDate(params.endDate);
  if (!end || end <= start) return round3(params.amount);

  const totalDays = daysBetween(start, end);
  const repeats = Math.max(1, Math.ceil(totalDays / intervalDays));
  return round3(params.amount * repeats);
}

export function makeAutoTaskSuggestion(params: {
  title: string;
  intent: GoalIntent;
  amount?: number | null;
  unit?: string | null;
  cadence?: MoneyCadence;
  startDate?: string | null;
  endDate?: string | null;
  targetValue?: number | null;
}): PreparedGoalTask {
  const amount = parsePositiveNumber(params.amount);
  const cadence = params.cadence ?? "daily";

  if (params.intent === "reading") {
    if (amount) {
      const unit = (params.unit ?? "pages").trim() || "pages";
      return { text: `Read ${amount} ${unit}`, incrementValue: amount };
    }
    return { text: "Read one focused session today" };
  }

  if (params.intent === "money_saving") {
    const unit = normalizeCurrencyUnit(params.unit);
    if (amount) {
      const prefix = unit === "$" ? "$" : `${unit} `;
      return {
        text: `Save ${prefix}${amount} ${cadenceLabel(cadence)}`,
        incrementValue: amount,
      };
    }
    return { text: "Save money toward this goal today" };
  }

  if (params.intent === "weight_loss") {
    const unit = (params.unit ?? "lb").trim() || "lb";
    const target = parsePositiveNumber(params.targetValue ?? amount);
    const end = parseIsoDate(params.endDate);
    const start = parseIsoDate(params.startDate) ?? new Date();
    if (target && end && end > start) {
      const daily = round3(target / daysBetween(start, end));
      if (daily > 0) {
        return {
          text: `Log your weight and complete your plan today`,
          incrementValue: daily,
        };
      }
    }
    if (target) {
      return {
        text: `Log your weight and complete your plan today`,
        incrementValue: round3(target / 30),
      };
    }
    return { text: `Log your ${unit} trend and complete your plan today` };
  }

  return { text: `Take one measurable step for ${params.title}` };
}

export function ensureSmartGoalTasks(params: {
  title: string;
  intent: GoalIntent;
  unit?: string | null;
  amount?: number | null;
  cadence?: MoneyCadence;
  startDate?: string | null;
  endDate?: string | null;
  targetValue?: number | null;
  tasks: GoalTaskDraft[];
}): PreparedGoalTask[] {
  const normalized = params.tasks
    .map((task) => {
      const text = task.text.trim();
      if (!text) return null;
      const incrementValue = parsePositiveNumber(task.incrementValue);
      return {
        text,
        incrementValue: incrementValue ?? undefined,
      };
    })
    .filter((task) => task !== null) as PreparedGoalTask[];

  const autoTask = makeAutoTaskSuggestion({
    title: params.title,
    intent: params.intent,
    amount: params.amount,
    unit: params.unit,
    cadence: params.cadence,
    startDate: params.startDate,
    endDate: params.endDate,
    targetValue: params.targetValue,
  });

  if (normalized.length === 0) {
    return autoTask.text ? [autoTask] : [];
  }

  const hasAnyIncrement = normalized.some((task) => parsePositiveNumber(task.incrementValue) !== null);
  if (!hasAnyIncrement && autoTask.incrementValue) {
    const first = normalized[0]!;
    const rest = normalized.slice(1);
    return [{ text: first.text, incrementValue: autoTask.incrementValue }, ...rest];
  }

  return normalized;
}

export function normalizeDecomposedGoalOutput(
  rawGoal: Partial<DecomposedGoalOutput> | null | undefined,
  description: string
): DecomposedGoalOutput {
  const title = (rawGoal?.title ?? "").trim();
  const why = (rawGoal?.why ?? "").trim() || null;
  const smart = inferGoalSmartSuggestion(title || description, why ?? undefined, rawGoal?.category ?? null);

  const normalizedTitle =
    title.length >= 3 && title.length <= 120 ? title : buildFallbackTitle(description);
  const category = rawGoal?.category ?? smart.category;
  const targetValue = parsePositiveNumber(rawGoal?.targetValue) ?? null;
  const unit = (rawGoal?.unit ?? "").trim() || smart.unit;

  const suggestedTasks =
    Array.isArray(rawGoal?.suggestedTasks) && rawGoal.suggestedTasks.length > 0
      ? rawGoal.suggestedTasks.map((task) => task.trim()).filter(Boolean).slice(0, 6)
      : [makeAutoTaskSuggestion({ title: normalizedTitle, intent: smart.intent, targetValue, unit }).text];

  const suggestedMilestones =
    Array.isArray(rawGoal?.suggestedMilestones) && rawGoal.suggestedMilestones.length > 0
      ? rawGoal.suggestedMilestones
          .map((milestone) => milestone.trim())
          .filter(Boolean)
          .slice(0, 5)
      : buildMilestones(targetValue, unit ?? null);

  const rawDate = rawGoal?.suggestedEndDate ?? null;
  const suggestedEndDate =
    typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : inferDateFromText(description);

  return {
    title: normalizedTitle,
    why,
    category,
    targetValue,
    unit: unit ?? null,
    suggestedMilestones,
    suggestedTasks,
    suggestedEndDate: suggestedEndDate ?? null,
  };
}
