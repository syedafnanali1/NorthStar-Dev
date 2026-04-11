// src/server/services/notifications.service.ts

import { db } from "@/lib/db";
import { notifications, notificationTypeEnum } from "@/drizzle/schema";
import { eq, and, count, desc } from "drizzle-orm";

type NotificationType = typeof notificationTypeEnum.enumValues[number];
interface NotificationOptions {
  channel?: string;
  metadata?: Record<string, unknown>;
  scheduledFor?: Date | null;
  sentAt?: Date | null;
}

export const notificationsService = {
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    link?: string,
    options?: NotificationOptions
  ): Promise<void> {
    await db.insert(notifications).values({
      userId,
      type,
      title,
      body,
      link: link ?? null,
      channel: options?.channel ?? "in_app",
      metadata: options?.metadata ?? {},
      scheduledFor: options?.scheduledFor ?? null,
      sentAt: options?.sentAt ?? new Date(),
    });
  },

  async createAdaptiveNotification(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    link: string | undefined,
    preferredWindow: "Morning" | "Afternoon" | "Evening" | "Late Night"
  ): Promise<void> {
    await this.createNotification(userId, type, title, body, link, {
      metadata: { preferredWindow },
    });
  },

  async getNotifications(userId: string, limit = 20) {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  },

  async getUnreadCount(userId: string): Promise<number> {
    const [row] = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return row?.count ?? 0;
  },

  async markAllRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  },

  async markOneRead(notificationId: string, userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  },
};
