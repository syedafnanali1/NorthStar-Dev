export const runtime = "edge";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { wearablesService } from "@/server/services/wearables.service";
import type { NextRequest } from "next/server";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).optional().default(3),
});

const applySchema = z.object({
  goalId: z.string().min(1),
  value: z.coerce.number().positive(),
  note: z.string().max(300).optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  try {
    const [suggestions, summary] = await Promise.all([
      wearablesService.getProgressSuggestions(userId, parsed.data.days),
      wearablesService.getLatestHealthSummary(userId),
    ]);
    return NextResponse.json({ suggestions, summary });
  } catch (err) {
    console.error("[GET /api/wearables/suggestions]", err);
    return NextResponse.json({ error: "Failed to fetch wearable suggestions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body: unknown = await request.json();
    const parsed = applySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }
    await wearablesService.applySuggestion(userId, parsed.data);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to apply suggestion";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

