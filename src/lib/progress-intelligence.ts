// src/lib/progress-intelligence.ts
// Infer auto progress increments from goal/task language.

type UnitKind = "currency" | "time" | "distance" | "count" | "weight" | "generic";

export interface InferTaskIncrementInput {
  goalTitle: string;
  goalUnit?: string | null;
  goalCategory?: string | null;
  goalTargetValue?: number | null;
  taskText: string;
}

function parseNumber(raw: string): number | null {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized.endsWith("k")) {
    const base = Number.parseFloat(normalized.slice(0, -1));
    if (!Number.isFinite(base)) return null;
    return base * 1000;
  }

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

function unitKindFromToken(token: string): UnitKind {
  const t = token.toLowerCase();

  if (
    t === "$" ||
    t === "\u20ac" ||
    t === "\u00a3" ||
    t === "\u00a5" ||
    t === "usd" ||
    t === "dollar" ||
    t === "dollars" ||
    t === "bucks" ||
    t === "eur" ||
    t === "euro" ||
    t === "euros"
  ) {
    return "currency";
  }

  if (["hour", "hours", "hr", "hrs", "h", "minute", "minutes", "min", "mins"].includes(t)) {
    return "time";
  }

  if (["mile", "miles", "mi", "km", "kms", "kilometer", "kilometers", "kilometre", "kilometres"].includes(t)) {
    return "distance";
  }

  if (["kg", "kilogram", "kilograms", "lb", "lbs"].includes(t)) {
    return "weight";
  }

  if (["page", "pages", "word", "words", "step", "steps", "rep", "reps", "set", "sets"].includes(t)) {
    return "count";
  }

  return "generic";
}

function detectKindFromText(text: string): UnitKind {
  const t = text.toLowerCase();

  if (
    /[$\u20ac\u00a3\u00a5]|\busd\b|\bdollars?\b|\beuros?\b|\bmoney\b|\bsave\b|\binvest\b|\bdebt\b/.test(t)
  ) {
    return "currency";
  }

  if (/\bhours?\b|\bhrs?\b|\bhr\b|\bminutes?\b|\bmins?\b|\bmin\b/.test(t)) {
    return "time";
  }

  if (/\bmiles?\b|\bmi\b|\bkm\b|\bkms\b|\bkilometers?\b|\bkilometres?\b/.test(t)) {
    return "distance";
  }

  if (/\bkg\b|\bkilograms?\b|\blbs?\b/.test(t)) {
    return "weight";
  }

  if (/\bpages?\b|\bwords?\b|\bsteps?\b|\breps?\b|\bsets?\b/.test(t)) {
    return "count";
  }

  return "generic";
}

function detectGoalKind(input: InferTaskIncrementInput): UnitKind {
  if (input.goalCategory === "finance") return "currency";
  if (input.goalUnit && input.goalUnit.trim()) {
    const unitKind = detectKindFromText(input.goalUnit);
    if (unitKind !== "generic") return unitKind;
  }
  return detectKindFromText(input.goalTitle);
}

function isCompatible(goalKind: UnitKind, parsedKind: UnitKind): boolean {
  if (goalKind === "generic" || parsedKind === "generic") return true;
  return goalKind === parsedKind;
}

export function inferTaskIncrementFromText(input: InferTaskIncrementInput): number | null {
  const text = input.taskText.trim();
  if (!text) return null;

  const goalKind = detectGoalKind(input);
  let parsedValue: number | null = null;
  let parsedKind: UnitKind = "generic";

  const currencyMatch = text.match(/(?:^|[\s(])([$\u20ac\u00a3\u00a5])\s*(\d+(?:\.\d+)?k?)/i);
  if (currencyMatch) {
    parsedValue = parseNumber(currencyMatch[2] ?? "");
    parsedKind = "currency";
  }

  if (parsedValue === null) {
    const numberUnitMatch = text.match(
      /(?:^|[\s(])(\d+(?:\.\d+)?k?)\s*(hours?|hrs?|hr|h|minutes?|mins?|min|miles?|mi|km|kms|kilometers?|kilometres?|pages?|words?|steps?|reps?|sets?|kg|kilograms?|lbs?|dollars?|usd|euros?|eur|bucks?)\b/i
    );
    if (numberUnitMatch) {
      parsedValue = parseNumber(numberUnitMatch[1] ?? "");
      parsedKind = unitKindFromToken(numberUnitMatch[2] ?? "");
    }
  }

  if (parsedValue === null) {
    const runKMatch = text.match(/\b(run|walk|jog|cycle|bike)\b[^\d]{0,24}(\d+(?:\.\d+)?)\s*k\b/i);
    if (runKMatch) {
      parsedValue = parseNumber(runKMatch[2] ?? "");
      parsedKind = "distance";
    }
  }

  if (parsedValue === null) {
    const verbNumberMatch = text.match(
      /\b(save|invest|deposit|pay|earn|read|write|run|walk|study|practice|meditate|lift|lose|gain|drink)\b[^\d]{0,24}(\d+(?:\.\d+)?k?)/i
    );
    if (verbNumberMatch) {
      parsedValue = parseNumber(verbNumberMatch[2] ?? "");
      const verb = (verbNumberMatch[1] ?? "").toLowerCase();
      parsedKind = ["save", "invest", "deposit", "pay", "earn"].includes(verb)
        ? "currency"
        : "generic";
    }
  }

  if (parsedValue === null || !Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  if (!isCompatible(goalKind, parsedKind)) {
    return null;
  }

  if (input.goalTargetValue && parsedValue > input.goalTargetValue * 2) {
    return null;
  }

  return Math.round(parsedValue * 1000) / 1000;
}
