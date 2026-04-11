import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { teamsService } from "@/server/services/teams.service";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ teamId: string }>;
}

export async function GET(
  _request: NextRequest,
  ctx: RouteContext
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { teamId } = await ctx.params;
    const dashboard = await teamsService.getTeamDashboard(teamId, userId);
    return NextResponse.json({ dashboard });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load dashboard";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

