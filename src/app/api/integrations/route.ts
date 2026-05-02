export const runtime = "edge";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { integrationsService } from "@/server/services/integrations.service";
import type { NextRequest } from "next/server";

const connectSchema = z.object({
  provider: z.string().min(2).max(80),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connections = await integrationsService.listConnections(userId);
  return NextResponse.json({ connections });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as unknown;
    const parsed = connectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const connection = await integrationsService.connect({
      userId,
      provider: parsed.data.provider,
      accessToken: parsed.data.accessToken,
      refreshToken: parsed.data.refreshToken,
      config: parsed.data.config,
      isActive: parsed.data.isActive,
    });
    return NextResponse.json({ connection }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to connect integration";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

