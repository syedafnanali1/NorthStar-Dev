export const runtime = "edge";

// src/app/api/ai/coach/route.ts
// POST /api/ai/coach — trigger an AI coaching action

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { aiCoachService } from "@/server/services/ai-coach.service";
import { weeklyDigestService } from "@/server/services/weekly-digest.service";
import type { NextRequest } from "next/server";

const bodySchema = z.object({
  type: z.enum(["weekly_review", "nudge", "correlations", "predict", "suggestions"]),
  goalId: z.string().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { type, goalId } = parsed.data;

    switch (type) {
      case "weekly_review": {
        const result = await aiCoachService.generateWeeklyReview(userId);
        return NextResponse.json({ result });
      }

      case "nudge": {
        if (!goalId) {
          return NextResponse.json(
            { error: "goalId is required for nudge" },
            { status: 422 }
          );
        }
        const result = await aiCoachService.generateNudge(userId, goalId);
        return NextResponse.json({ result });
      }

      case "correlations": {
        const result = await aiCoachService.detectCorrelations(userId);
        return NextResponse.json({ result });
      }

      case "predict": {
        if (!goalId) {
          return NextResponse.json(
            { error: "goalId is required for predict" },
            { status: 422 }
          );
        }
        const result = await aiCoachService.getPredictedCompletion(
          goalId,
          userId
        );
        return NextResponse.json({ result });
      }

      case "suggestions": {
        const [digest, smartSuggestions] = await Promise.all([
          weeklyDigestService.getWeeklyDigestSummary(userId),
          aiCoachService.getSmartGoalSuggestions(userId, 3),
        ]);
        return NextResponse.json({
          result: {
            suggestions: digest.suggestions,
            smartSuggestions,
            smartSuggestionMessages: smartSuggestions.map(
              (item) => `${item.reason} Try: ${item.title}.`
            ),
            correlations: digest.correlations,
            moodTrend: digest.moodTrend,
            sleepTrend: digest.sleepTrend,
          },
        });
      }
    }
  } catch (err) {
    console.error("[POST /api/ai/coach]", err);
    const message =
      err instanceof Error ? err.message : "AI coaching request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Mark an insight as read
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { insightId?: string };
    if (!body.insightId) {
      return NextResponse.json({ error: "insightId required" }, { status: 422 });
    }
    await aiCoachService.markRead(body.insightId, userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[PATCH /api/ai/coach]", err);
    return NextResponse.json({ error: "Failed to update insight" }, { status: 500 });
  }
}
