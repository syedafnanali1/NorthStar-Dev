import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { analyticsService } from "@/server/services/analytics.service";

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const categories = await analyticsService.getCategoryBreakdown(userId);
  const scored = categories.map((category) => ({
    ...category,
    score: Math.round(category.avgProgress),
  }));

  const lifeScore =
    scored.length === 0
      ? 0
      : Math.round(
          scored.reduce((sum, category) => sum + category.score, 0) / scored.length
        );

  const strongest = [...scored].sort((a, b) => b.score - a.score)[0] ?? null;
  const weakest = [...scored].sort((a, b) => a.score - b.score)[0] ?? null;
  const imbalanceInsight =
    strongest && weakest
      ? `Your ${strongest.category} score is ${strongest.score}, while ${weakest.category} is ${weakest.score}.`
      : "Log more progress to generate a life-balance insight.";

  return NextResponse.json({
    lifeScore,
    domains: scored,
    imbalanceInsight,
  });
}
