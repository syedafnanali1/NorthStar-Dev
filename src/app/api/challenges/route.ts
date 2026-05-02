export const runtime = "edge";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { challengesService } from "@/server/services/challenges.service";
import type { NextRequest } from "next/server";

const createSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().max(600).optional(),
  category: z.enum(["health", "finance", "writing", "body", "mindset", "custom"]).optional(),
  targetValue: z.coerce.number().positive(),
  unit: z.string().min(1).max(30),
  startDate: z.string(),
  endDate: z.string(),
  isPublic: z.boolean().optional().default(true),
  isSponsored: z.boolean().optional().default(false),
  sponsorName: z.string().max(80).optional(),
  sponsorPrize: z.string().max(180).optional(),
  isAiMicro: z.boolean().optional().default(false),
});

const listQuerySchema = z.object({
  status: z.enum(["upcoming", "active", "completed", "archived"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(40),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = listQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  try {
    const challenges = await challengesService.listChallenges(userId, parsed.data);
    return NextResponse.json({ challenges });
  } catch (err) {
    console.error("[GET /api/challenges]", err);
    return NextResponse.json({ error: "Failed to list challenges" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body: unknown = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const challenge = await challengesService.createChallenge(userId, parsed.data);
    return NextResponse.json({ challenge }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create challenge";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

