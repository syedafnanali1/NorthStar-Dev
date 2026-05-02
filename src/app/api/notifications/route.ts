export const runtime = "edge";

// src/app/api/notifications/route.ts
// GET — returns { notifications, unreadCount }

import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/helpers";
import { notificationsService } from "@/server/services/notifications.service";

export async function GET(): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [notifs, unreadCount] = await Promise.all([
    notificationsService.getNotifications(userId),
    notificationsService.getUnreadCount(userId),
  ]);

  return NextResponse.json({ notifications: notifs, unreadCount });
}
