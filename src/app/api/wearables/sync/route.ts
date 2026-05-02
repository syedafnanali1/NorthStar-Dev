export const runtime = "edge";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { wearablesService } from "@/server/services/wearables.service";
import { notificationsService } from "@/server/services/notifications.service";
import type { NextRequest } from "next/server";

const sampleSchema = z.object({
  metricType: z.enum([
    "steps",
    "distance_km",
    "sleep_hours",
    "calories",
    "heart_rate",
    "weight",
    "active_minutes",
  ]),
  value: z.coerce.number().min(0),
  recordedAt: z.string(),
  sourcePayload: z.record(z.string(), z.unknown()).optional(),
});

const bodySchema = z.object({
  provider: z.enum(["apple_health", "google_fit", "manual_import"]),
  samples: z.array(sampleSchema).max(500),
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

    const result = await wearablesService.ingestSamples(
      userId,
      parsed.data.provider,
      parsed.data.samples
    );

    if (result.inserted > 0) {
      await notificationsService.createNotification(
        userId,
        "wearable_sync",
        "Wearable sync complete",
        `${result.inserted} health datapoints synced.`,
        "/calendar"
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to sync wearable data";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

