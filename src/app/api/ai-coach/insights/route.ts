export const runtime = "edge";

// GET /api/ai-coach/insights
// Returns AI coach insights for a user, optionally filtered by goalId.
// Supports ?tone=encouraging|straightforward|tough to colour the language.
// Lazily generates a fresh nudge if the inbox is empty for the given goal.

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { aiCoachService } from "@/server/services/ai-coach.service";
import { db } from "@/lib/db";
import { aiInsights } from "@/drizzle/schema";
import { and, desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

type Tone = "encouraging" | "straightforward" | "tough";

function applyTone(content: string, tone: Tone, goalTitle?: string): { title: string; body: string } {
  const sentences = content.split(/(?<=[.!?])\s+/).filter(Boolean);
  const firstSentence = sentences[0] ?? content;
  const rest = sentences.slice(1).join(" ");
  const titleText = firstSentence.length > 72
    ? `${firstSentence.slice(0, 69)}…`
    : firstSentence;

  let body = content;

  if (tone === "encouraging") {
    const prefix = goalTitle
      ? `You're making real progress on "${goalTitle}". `
      : "You're doing great. ";
    body = prefix + content;
  } else if (tone === "tough") {
    const prefix = goalTitle
      ? `No excuses — here's what the data says about "${goalTitle}". `
      : "Let's be direct. ";
    body = prefix + content;
  }
  // "straightforward" keeps content as-is

  return {
    title: titleText,
    body,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const goalId = searchParams.get("goalId") ?? undefined;
  const limit  = Math.min(10, Math.max(1, Number(searchParams.get("limit") ?? "5")));
  const tone   = (searchParams.get("tone") ?? "straightforward") as Tone;

  const validTones: Tone[] = ["encouraging", "straightforward", "tough"];
  const safeTone: Tone = validTones.includes(tone) ? tone : "straightforward";

  try {
    // Fetch recent insights for this user (+ optionally filtered by goal)
    const conditions = goalId
      ? and(eq(aiInsights.userId, userId), eq(aiInsights.goalId, goalId))
      : eq(aiInsights.userId, userId);

    let rows = await db
      .select()
      .from(aiInsights)
      .where(conditions)
      .orderBy(desc(aiInsights.createdAt))
      .limit(limit);

    // If no stored insights exist for this goal, lazily generate a nudge
    if (rows.length === 0 && goalId) {
      try {
        await aiCoachService.generateNudge(userId, goalId, {
          persistInsight: true,
          createNotification: false,
        });
        // Re-fetch the newly created insight
        rows = await db
          .select()
          .from(aiInsights)
          .where(and(eq(aiInsights.userId, userId), eq(aiInsights.goalId, goalId)))
          .orderBy(desc(aiInsights.createdAt))
          .limit(limit);
      } catch {
        // Graceful: return empty if generation fails (API key missing, etc.)
        return NextResponse.json({ insights: [] });
      }
    }

    const insights = rows.map((row) => {
      const { title, body } = applyTone(row.content, safeTone);
      return {
        id: row.id,
        type: row.type,
        title,
        body,
        createdAt: row.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ insights });
  } catch (err) {
    console.error("[GET /api/ai-coach/insights]", err);
    return NextResponse.json({ error: "Failed to load insights" }, { status: 500 });
  }
}
