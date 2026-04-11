import { NextResponse } from "next/server";
import { z } from "zod";
import { coachService } from "@/server/services/coach.service";
import type { NextRequest } from "next/server";

const conversionSchema = z.object({
  referralCode: z.string().min(4).max(40),
  clientUserId: z.string(),
  revenueCents: z.number().int().positive(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as unknown;
    const parsed = conversionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const conversion = await coachService.recordReferralConversion({
      referralCode: parsed.data.referralCode,
      clientUserId: parsed.data.clientUserId,
      revenueCents: parsed.data.revenueCents,
    });
    return NextResponse.json({ conversion }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record referral conversion";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

