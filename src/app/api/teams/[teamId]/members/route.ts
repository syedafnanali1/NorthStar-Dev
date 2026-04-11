import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth/helpers";
import { teamsService } from "@/server/services/teams.service";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ teamId: string }>;
}

const addMemberSchema = z.object({
  userId: z.string().optional(),
  username: z.string().min(2).max(32).optional(),
  email: z.string().email().optional(),
  role: z.enum(["member", "admin"]).optional().default("member"),
});

export async function GET(
  _request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await ctx.params;
  try {
    const members = await teamsService.listMembers(teamId, userId);
    return NextResponse.json({ members });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list members";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function POST(
  request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { teamId } = await ctx.params;
    const body = (await request.json()) as unknown;
    const parsed = addMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const member = await teamsService.addMember({
      teamId,
      actorUserId: userId,
      targetUserId: parsed.data.userId,
      username: parsed.data.username,
      email: parsed.data.email,
      role: parsed.data.role,
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add member";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
