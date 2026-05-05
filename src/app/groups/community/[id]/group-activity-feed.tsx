"use client";

// src/app/groups/community/[id]/group-activity-feed.tsx
// Chronological activity feed for group goal check-ins.

import { useEffect, useState } from "react";
import { CheckCircle2, UserPlus, Star, Clock } from "lucide-react";
import { cn } from "@/lib/utils/index";

interface ActivityItem {
  type: "checkin" | "joined" | "completed";
  userId: string;
  userName: string | null;
  userImage: string | null;
  goalName?: string;
  note?: string | null;
  value?: number;
  loggedAt: string;
}

interface GroupActivityFeedProps {
  groupId: string;
  isMember: boolean;
}

function ActivityAvatar({ name, image }: { name: string | null; image: string | null }) {
  const inits = name ? name.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") : "?";
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold/20 text-[0.6rem] font-bold text-gold">
      {image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={image} alt={name ?? ""} className="h-full w-full object-cover" />
        : inits}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function GroupActivityFeed({ groupId, isMember }: GroupActivityFeedProps) {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/groups/${groupId}/activity`)
      .then((r) => r.json())
      .then((d: { items?: ActivityItem[] }) => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [groupId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-cream-dark" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-3/4 animate-pulse rounded bg-cream-dark" />
              <div className="h-2.5 w-1/2 animate-pulse rounded bg-cream-dark" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-cream-dark py-10 text-center">
        <Clock className="mb-2 h-8 w-8 text-ink-muted/40" />
        <p className="text-sm font-medium text-ink-muted">No activity yet</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {isMember
            ? "Start checking in on group goals to see activity here."
            : "Join the group to see member activity."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-start gap-3 rounded-xl px-1 py-2.5">
          {/* Avatar */}
          <ActivityAvatar name={item.userName} image={item.userImage} />

          {/* Content */}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink">
              <span className="font-semibold">{item.userName ?? "Someone"}</span>
              {" "}
              {item.type === "checkin" && (
                <>
                  <span className="text-ink-muted">checked in on</span>{" "}
                  <span className="font-medium">{item.goalName}</span>
                  {item.value != null && item.value !== 1 && (
                    <span className="text-ink-muted"> · {item.value}</span>
                  )}
                </>
              )}
              {item.type === "completed" && (
                <>
                  <span className="text-ink-muted">completed</span>{" "}
                  <span className="font-medium">{item.goalName}</span>
                  {" "}<Star className="inline h-3.5 w-3.5 fill-gold text-gold" />
                </>
              )}
              {item.type === "joined" && (
                <span className="text-ink-muted">joined the group</span>
              )}
            </p>
            {item.note && (
              <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">&quot;{item.note}&quot;</p>
            )}
          </div>

          {/* Icon + time */}
          <div className="flex shrink-0 flex-col items-end gap-1">
            <div className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full",
              item.type === "checkin" ? "bg-emerald-50" : item.type === "completed" ? "bg-gold/10" : "bg-sky-50"
            )}>
              {item.type === "checkin" && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
              {item.type === "completed" && <Star className="h-3 w-3 fill-gold text-gold" />}
              {item.type === "joined" && <UserPlus className="h-3 w-3 text-sky-500" />}
            </div>
            <span className="text-[10px] text-ink-muted">{timeAgo(item.loggedAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
