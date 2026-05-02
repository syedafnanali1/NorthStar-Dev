export const runtime = "edge";

// src/app/api/coach/ai-chat/route.ts
// AI chat endpoint for the Coach Dashboard.
// Sends aggregated team stats as context with each message.

import { NextResponse } from "next/server";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";

const bodySchema = z.object({
  message: z.string().min(1).max(2000),
  teamStats: z.object({
    totalGoals: z.number(),
    completedGoals: z.number(),
    retentionRate: z.number(),
    avgGoalsPerUser: z.number(),
  }),
  memberCount: z.number(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .optional(),
});

const COACH_SYSTEM_PROMPT = `You are a professional performance coach assistant for team managers using NorthStar.
You have access to aggregated team goal data. Your role is to provide clear, professional, actionable advice
on how the manager can improve their team's goal completion rates, engagement, and overall performance.
Be specific, use the data provided, and give prioritized recommendations.
Never give vague advice. Always ground your insights in the team metrics shown.`;

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

    const { message, teamStats, memberCount, history = [] } = parsed.data;

    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI coaching is not configured. Set ANTHROPIC_API_KEY to enable." },
        { status: 503 }
      );
    }

    const teamContext = `
Team stats:
- Members: ${memberCount}
- Total goals set: ${teamStats.totalGoals}
- Goals completed: ${teamStats.completedGoals}
- Goal retention rate: ${teamStats.retentionRate}%
- Average goals per user: ${teamStats.avgGoalsPerUser}
`;

    const priorMessages = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: `${COACH_SYSTEM_PROMPT}\n\nCurrent team context:\n${teamContext}`,
        messages: [
          ...priorMessages,
          { role: "user", content: message },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
    };

    const reply = data.content[0]?.type === "text" && data.content[0].text
      ? data.content[0].text
      : "No response generated.";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[POST /api/coach/ai-chat]", err);
    return NextResponse.json({ error: "AI coaching request failed" }, { status: 500 });
  }
}
