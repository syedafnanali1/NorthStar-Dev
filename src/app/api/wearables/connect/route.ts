export const runtime = "edge";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { wearablesService } from "@/server/services/wearables.service";
import type { NextRequest } from "next/server";

const bodySchema = z.object({
  provider: z.enum(["apple_health", "google_fit", "manual_import"]),
  externalUserId: z.string().max(200).optional(),
  accessToken: z.string().max(5000).optional(),
  refreshToken: z.string().max(5000).optional(),
  scopes: z.array(z.string().max(120)).max(40).optional().default([]),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body: unknown = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }
    await wearablesService.connect(userId, parsed.data);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to connect wearable";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

