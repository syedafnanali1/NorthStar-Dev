import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { coachService } from "@/server/services/coach.service";
import type { NextRequest } from "next/server";

const updateSchema = z.object({
  headline: z.string().max(140).optional(),
  bio: z.string().max(1000).optional(),
  referralCode: z.string().min(4).max(40).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await coachService.getProfile(userId);
  return NextResponse.json({ profile });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as unknown;
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const profile = await coachService.upsertProfile({
      userId,
      headline: parsed.data.headline,
      bio: parsed.data.bio,
      referralCode: parsed.data.referralCode,
      isActive: parsed.data.isActive,
    });
    return NextResponse.json({ profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update coach profile";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

