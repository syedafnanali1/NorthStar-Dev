"use client";

// src/components/notifications/notification-panel.tsx

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/index";
import { NotificationItem } from "./notification-item";
import type { Notification } from "@/drizzle/schema";

interface NotificationPanelProps {
  notifications: Notification[];
  open: boolean;
  onClose: () => void;
  onMarkAllRead: () => void;
  onMarkOneRead: (id: string) => void;
}

export function NotificationPanel({
  notifications,
  open,
  onClose,
  onMarkAllRead,
  onMarkOneRead,
}: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l border-cream-dark bg-cream-paper shadow-xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cream-dark px-4 py-4">
          <div>
            <h2 className="font-serif text-base font-semibold text-ink">Notifications</h2>
            {unreadCount > 0 && (
              <p className="text-xs text-ink-muted">{unreadCount} unread</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="rounded-lg px-2 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:bg-cream hover:text-ink"
              >
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-cream hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="text-4xl">🔔</span>
              <p className="text-sm font-medium text-ink-soft">All caught up</p>
              <p className="text-xs text-ink-muted">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={onMarkOneRead}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
