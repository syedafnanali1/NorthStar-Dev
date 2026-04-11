// src/app/api/notifications/read-all/route.ts
// POST — mark all notifications as read

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { notificationsService } from "@/server/services/notifications.service";

export async function POST(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await notificationsService.markAllRead(userId);
  return NextResponse.json({ success: true });
}
