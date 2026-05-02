export const runtime = "edge";

// src/app/api/notifications/[id]/route.ts
// PATCH — mark a single notification as read

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { notificationsService } from "@/server/services/notifications.service";
import type { NextRequest } from "next/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  await notificationsService.markOneRead(id, userId);
  return NextResponse.json({ success: true });
}
