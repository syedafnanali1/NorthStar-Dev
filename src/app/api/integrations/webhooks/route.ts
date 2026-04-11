import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { integrationsService } from "@/server/services/integrations.service";
import type { NextRequest } from "next/server";

const createSchema = z.object({
  endpointUrl: z.string().url(),
  events: z.array(z.string().min(1).max(100)).min(1).max(20),
  teamId: z.string().optional(),
});

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const webhooks = await integrationsService.listWebhooks(userId);
  return NextResponse.json({ webhooks });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as unknown;
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const webhook = await integrationsService.registerWebhook({
      userId,
      endpointUrl: parsed.data.endpointUrl,
      events: parsed.data.events,
      teamId: parsed.data.teamId,
    });
    return NextResponse.json({ webhook }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to register webhook";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

