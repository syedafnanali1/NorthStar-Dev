export const runtime = "edge";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { teamsService } from "@/server/services/teams.service";
import type { NextRequest } from "next/server";

const createSchema = z.object({
  name: z.string().min(2).max(80),
});

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teams = await teamsService.getWorkspacesForUser(userId);
  return NextResponse.json({ teams });
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

    const team = await teamsService.createWorkspace(userId, parsed.data.name);
    return NextResponse.json({ team }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create team workspace";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

