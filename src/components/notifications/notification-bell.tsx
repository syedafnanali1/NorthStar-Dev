"use client";

// src/components/notifications/notification-bell.tsx
// Bell icon with unread badge; polls every 30s; opens slide-in panel.
// Also auto-pops the BadgeUnlockModal when unread achievement_unlocked notifications appear.

import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils/index";
import { NotificationPanel } from "./notification-panel";
import { BadgeUnlockModal, useBadgePopup } from "./badge-unlock-modal";
import type { Notification } from "@/drizzle/schema";

export function NotificationBell({ showLabel = false }: { showLabel?: boolean }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const { badge, clearBadge } = useBadgePopup();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications: Notification[];
        unreadCount: number;
      };
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // silent
    }
  }, []);

  // Initial fetch + 30s poll
  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(() => void fetchNotifications(), 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleOpen = () => {
    setOpen(true);
    void fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const handleMarkOneRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  return (
    <>
      {/* Badge popup modal */}
      <AnimatePresence>
        {badge && (
          <BadgeUnlockModal achievementKey={badge} onClose={clearBadge} />
        )}
      </AnimatePresence>

      {showLabel ? (
        <button
          type="button"
          onClick={handleOpen}
          title="Notifications"
          className={cn(
            "flex h-10 w-full items-center gap-3 rounded-xl px-[10px] transition-all duration-150 xl:px-3",
            open ? "bg-cream text-ink" : "text-ink-muted hover:bg-cream hover:text-ink"
          )}
        >
          <Bell className="h-[17px] w-[17px] flex-shrink-0" strokeWidth={1.8} />
          <span className="text-[0.84rem] font-medium tracking-[-0.005em]">Notifications</span>
          {unreadCount > 0 && (
            <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          title="Notifications"
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-2xl text-ink-muted transition-all duration-200 hover:bg-cream hover:text-ink",
            open && "bg-cream text-ink"
          )}
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-cream-paper">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      )}

      <NotificationPanel
        notifications={notifications}
        open={open}
        onClose={() => setOpen(false)}
        onMarkAllRead={handleMarkAllRead}
        onMarkOneRead={handleMarkOneRead}
        onNotificationActioned={fetchNotifications}
      />
    </>
  );
}
