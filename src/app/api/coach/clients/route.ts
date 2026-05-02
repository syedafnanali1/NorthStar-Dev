export const runtime = "edge";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { coachService } from "@/server/services/coach.service";
import type { NextRequest } from "next/server";

const linkSchema = z.object({
  clientUserId: z.string(),
});

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const clients = await coachService.listClients(userId);
    return NextResponse.json({ clients });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list clients";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as unknown;
    const parsed = linkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const link = await coachService.linkClient(userId, parsed.data.clientUserId);
    return NextResponse.json({ link }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to link client";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

