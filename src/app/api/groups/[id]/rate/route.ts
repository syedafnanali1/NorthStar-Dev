// src/app/api/groups/[id]/rate/route.ts
// POST /api/groups/[id]/rate — submit a recommendation rating (member only)

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { groupsService } from "@/server/services/groups.service";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const rateSchema = z.object({
  rating: z.number().int().min(1).max(10),
});

export async function POST(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body: unknown = await request.json();
    const validated = rateSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: "Rating must be an integer between 1 and 10" },
        { status: 422 }
      );
    }
    await groupsService.submitRecommendationRating(id, userId, validated.data.rating);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/groups/[id]/rate]", err);
    const message = err instanceof Error ? err.message : "Failed to submit rating";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
