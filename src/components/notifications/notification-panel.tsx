"use client";

// src/components/notifications/notification-panel.tsx

import { useEffect, useRef } from "react";
import { X, Bell } from "lucide-react";
import { cn } from "@/lib/utils/index";
import { NotificationItem } from "./notification-item";
import type { Notification } from "@/drizzle/schema";

interface NotificationPanelProps {
  notifications: Notification[];
  open: boolean;
  onClose: () => void;
  onMarkAllRead: () => void;
  onMarkOneRead: (id: string) => void;
  onNotificationActioned?: () => void;
}

export function NotificationPanel({
  notifications,
  open,
  onClose,
  onMarkAllRead,
  onMarkOneRead,
  onNotificationActioned,
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

  // Wrap onMarkOneRead to also trigger parent refresh after action
  const handleRead = (id: string) => {
    onMarkOneRead(id);
    onNotificationActioned?.();
  };

  const groups = {
    actionable: notifications.filter((n) => {
      const meta = (n.metadata as Record<string, unknown>) ?? {};
      const subtype = String(meta.subtype ?? "");
      return subtype === "circle_request" || subtype === "group_join_request";
    }),
    rest: notifications.filter((n) => {
      const meta = (n.metadata as Record<string, unknown>) ?? {};
      const subtype = String(meta.subtype ?? "");
      return subtype !== "circle_request" && subtype !== "group_join_request";
    }),
  };

  const sorted = [...groups.actionable, ...groups.rest];

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
          "fixed right-0 top-0 z-50 flex h-full w-[340px] flex-col border-l border-cream-dark bg-cream-paper shadow-xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cream-dark px-4 py-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-ink-muted" />
            <div>
              <h2 className="font-serif text-base font-semibold text-ink">Notifications</h2>
              {unreadCount > 0 && (
                <p className="text-xs text-ink-muted">{unreadCount} unread</p>
              )}
            </div>
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

        {/* Action-needed section */}
        {groups.actionable.length > 0 && (
          <div className="shrink-0 border-b border-cream-dark px-3 py-3">
            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-gold">
              Needs your response
            </p>
            <div className="space-y-2">
              {groups.actionable.map((n) => (
                <NotificationItem key={n.id} notification={n} onRead={handleRead} />
              ))}
            </div>
          </div>
        )}

        {/* Remaining list */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {groups.rest.length === 0 && groups.actionable.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="text-4xl">🔔</span>
              <p className="text-sm font-medium text-ink">All caught up</p>
              <p className="text-xs text-ink-muted">No notifications yet.</p>
            </div>
          ) : groups.rest.length === 0 ? null : (
            <>
              {groups.actionable.length > 0 && (
                <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-ink-muted">
                  Recent
                </p>
              )}
              <div className="space-y-1.5">
                {groups.rest.map((n) => (
                  <NotificationItem key={n.id} notification={n} onRead={handleRead} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
