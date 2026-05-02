export const runtime = "edge";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { challengesService } from "@/server/services/challenges.service";
import type { NextRequest } from "next/server";

const bodySchema = z.object({
  value: z.coerce.number().positive(),
  note: z.string().max(400).optional(),
});

interface RouteContext {
  params: Promise<{ challengeId: string }>;
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { challengeId } = await ctx.params;
  try {
    const body: unknown = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const result = await challengesService.logProgress(
      challengeId,
      userId,
      parsed.data.value,
      parsed.data.note
    );
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to log challenge progress";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

