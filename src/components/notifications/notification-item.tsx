"use client";

// src/components/notifications/notification-item.tsx

import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils/index";
import type { Notification } from "@/drizzle/schema";

const TYPE_EMOJI: Record<string, string> = {
  streak_risk: "🔥",
  friend_milestone: "🌟",
  achievement_unlocked: "🏆",
  weekly_review: "📊",
  group_message: "💬",
  comment: "💬",
  reaction: "❤️",
  level_up: "⭐",
  challenge_update: "🎯",
};

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
}

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const router = useRouter();

  const handleClick = () => {
    if (!notification.isRead) {
      onRead(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-cream",
        !notification.isRead && "bg-blue-50/50"
      )}
    >
      {/* Emoji icon */}
      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-cream-dark text-base">
        {TYPE_EMOJI[notification.type] ?? "🔔"}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight text-ink">{notification.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{notification.body}</p>
        <p className="mt-1 text-[10px] text-ink-muted">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </p>
      </div>

      {/* Unread dot */}
      {!notification.isRead && (
        <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
      )}
    </button>
  );
}
