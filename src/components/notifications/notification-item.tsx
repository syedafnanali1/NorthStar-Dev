"use client";

// src/components/notifications/notification-item.tsx
// Renders a single notification — handles rich subtypes:
//   circle_request   → bio card with Accept / Decline buttons
//   group_join_request → requester card with Approve / Reject (for owners)
//   group_join_approved / rejected → status cards
//   achievement_unlocked → badge card
//   default → simple icon + text row

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2, XCircle, Users, Trophy, Flame, Zap,
  MapPin, Briefcase, ArrowRight, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils/index";
import { toast } from "@/components/ui/toaster";
import type { Notification } from "@/drizzle/schema";

// ── Type helpers ──────────────────────────────────────────────────────────────

type Meta = Record<string, unknown>;

function getMeta(n: Notification): Meta {
  return (n.metadata as Meta) ?? {};
}

function getSubtype(n: Notification): string {
  return String(getMeta(n).subtype ?? "");
}

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
  group_milestone: "🎉",
  friend_activity: "👋",
  challenge_rank: "🏅",
  wearable_sync: "⌚",
  reengagement: "💫",
};

// ── Avatar ────────────────────────────────────────────────────────────────────

function SmallAvatar({ name, image, size = "md" }: { name?: string | null; image?: string | null; size?: "sm" | "md" | "lg" }) {
  const inits = name ? name.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") : "?";
  const dim = size === "lg" ? "h-12 w-12 text-sm" : size === "md" ? "h-10 w-10 text-xs" : "h-8 w-8 text-[10px]";
  return (
    <div className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold/20 font-bold text-gold", dim)}>
      {image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={image} alt={name ?? ""} className="h-full w-full object-cover" />
        : inits}
    </div>
  );
}

// ── Action buttons ─────────────────────────────────────────────────────────────

type ActionState = "idle" | "loading" | "done";

// ── Circle Request Card ────────────────────────────────────────────────────────

function CircleRequestCard({ notification, onRead }: { notification: Notification; onRead: (id: string) => void }) {
  const meta = getMeta(notification);
  const [state, setState] = useState<ActionState>("idle");
  const [result, setResult] = useState<"accepted" | "declined" | null>(null);

  const connectionId = String(meta.connectionId ?? "");
  const name = String(meta.requesterName ?? "Someone");
  const image = meta.requesterImage ? String(meta.requesterImage) : null;
  const bio = meta.requesterBio ? String(meta.requesterBio) : null;
  const location = meta.requesterLocation ? String(meta.requesterLocation) : null;
  const jobTitle = meta.requesterJobTitle ? String(meta.requesterJobTitle) : null;
  const streak = meta.requesterStreak ? Number(meta.requesterStreak) : null;
  const momentum = meta.requesterMomentum ? Number(meta.requesterMomentum) : null;

  async function respond(action: "accept" | "decline") {
    if (!connectionId || state !== "idle") return;
    setState("loading");
    try {
      const res = await fetch("/api/circle/connect", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, action }),
      });
      if (!res.ok) throw new Error("Failed");
      setResult(action === "accept" ? "accepted" : "declined");
      setState("done");
      onRead(notification.id);
      toast(action === "accept" ? `${name} is now in your Circle! 🎉` : "Request declined.", action === "accept" ? "success" : undefined);
    } catch {
      toast("Something went wrong.", "error");
      setState("idle");
    }
  }

  return (
    <div className={cn("rounded-2xl border p-4 transition-colors", !notification.isRead ? "border-blue-100 bg-blue-50/40" : "border-cream-dark bg-cream-paper")}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <SmallAvatar name={name} image={image} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">{name}</p>
          {jobTitle && <p className="text-xs text-ink-muted">{jobTitle}</p>}
          {location && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted">
              <MapPin className="h-3 w-3" />{location}
            </p>
          )}
        </div>
        <span className="shrink-0 text-[10px] text-ink-muted">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </span>
      </div>

      {/* Bio */}
      {bio && (
        <p className="mt-2.5 line-clamp-2 rounded-xl bg-cream px-3 py-2 text-xs italic leading-relaxed text-ink-muted">
          &ldquo;{bio}&rdquo;
        </p>
      )}

      {/* Stats */}
      {(streak != null || momentum != null) && (
        <div className="mt-2 flex gap-3">
          {streak != null && (
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
              <Flame className="h-3 w-3" />{streak}d streak
            </span>
          )}
          {momentum != null && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              <Zap className="h-3 w-3" />{momentum} momentum
            </span>
          )}
        </div>
      )}

      {/* Action */}
      <div className="mt-3">
        {result === "accepted" ? (
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
            <UserCheck className="h-4 w-4" /> Added to Circle!
          </div>
        ) : result === "declined" ? (
          <p className="text-sm text-ink-muted">Request declined.</p>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={state === "loading"}
              onClick={() => void respond("accept")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gold px-4 py-2 text-sm font-bold text-ink transition hover:opacity-90 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              {state === "loading" ? "…" : "Accept"}
            </button>
            <button
              type="button"
              disabled={state === "loading"}
              onClick={() => void respond("decline")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-cream-dark px-4 py-2 text-sm font-semibold text-ink-muted transition hover:bg-cream-dark disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" />
              Decline
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Group Join Request Card (owner view) ──────────────────────────────────────

function GroupJoinRequestCard({ notification, onRead }: { notification: Notification; onRead: (id: string) => void }) {
  const meta = getMeta(notification);
  const [state, setState] = useState<ActionState>("idle");
  const [result, setResult] = useState<"approved" | "rejected" | null>(null);

  const joinRequestId = String(meta.joinRequestId ?? "");
  const groupId = String(meta.groupId ?? "");
  const groupName = String(meta.groupName ?? "the group");
  const name = String(meta.requesterName ?? "Someone");
  const image = meta.requesterImage ? String(meta.requesterImage) : null;
  const bio = meta.requesterBio ? String(meta.requesterBio) : null;
  const location = meta.requesterLocation ? String(meta.requesterLocation) : null;
  const jobTitle = meta.requesterJobTitle ? String(meta.requesterJobTitle) : null;
  const streak = meta.requesterStreak ? Number(meta.requesterStreak) : null;

  async function respond(action: "approve" | "reject") {
    if (!joinRequestId || state !== "idle") return;
    setState("loading");
    try {
      const res = await fetch(`/api/groups/${groupId}/requests`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: joinRequestId, action }),
      });
      if (!res.ok) throw new Error("Failed");
      setResult(action === "approve" ? "approved" : "rejected");
      setState("done");
      onRead(notification.id);
      toast(action === "approve" ? `${name} approved!` : "Request rejected.", action === "approve" ? "success" : undefined);
    } catch {
      toast("Something went wrong.", "error");
      setState("idle");
    }
  }

  return (
    <div className={cn("rounded-2xl border p-4 transition-colors", !notification.isRead ? "border-amber-100 bg-amber-50/30" : "border-cream-dark bg-cream-paper")}>
      <div className="mb-2.5 flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-amber-600" />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
          Join request · {groupName}
        </p>
      </div>

      <div className="flex items-start gap-3">
        <SmallAvatar name={name} image={image} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">{name}</p>
          {jobTitle && <p className="text-xs text-ink-muted">{jobTitle}</p>}
          {location && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted">
              <MapPin className="h-3 w-3" />{location}
            </p>
          )}
          {streak != null && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              <Flame className="h-2.5 w-2.5" />{streak}d streak
            </span>
          )}
        </div>
        <span className="shrink-0 text-[10px] text-ink-muted">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </span>
      </div>

      {bio && (
        <p className="mt-2 line-clamp-2 rounded-xl bg-cream px-3 py-2 text-xs italic text-ink-muted">
          &ldquo;{bio}&rdquo;
        </p>
      )}

      <div className="mt-3">
        {result === "approved" ? (
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> Approved — {name} is now a member!
          </div>
        ) : result === "rejected" ? (
          <p className="text-sm text-ink-muted">Request rejected.</p>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={state === "loading"}
              onClick={() => void respond("approve")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              {state === "loading" ? "…" : "Approve"}
            </button>
            <button
              type="button"
              disabled={state === "loading"}
              onClick={() => void respond("reject")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-cream-dark px-4 py-2 text-sm font-semibold text-ink-muted transition hover:bg-cream-dark disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" />
              Decline
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Group Approved Card ────────────────────────────────────────────────────────

function GroupApprovedCard({ notification }: { notification: Notification }) {
  const meta = getMeta(notification);
  const groupName = String(meta.groupName ?? "the group");
  const groupId = String(meta.groupId ?? "");

  return (
    <a
      href={`/groups/community/${groupId}`}
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4 transition-colors hover:bg-cream",
        !notification.isRead ? "border-emerald-100 bg-emerald-50/30" : "border-cream-dark bg-cream-paper"
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-xl">
        🎉
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">Welcome to {groupName}!</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Your join request was approved. Tap to open the group.
        </p>
        <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
          Open group <ArrowRight className="h-3 w-3" />
        </span>
      </div>
      <span className="shrink-0 text-[10px] text-ink-muted">
        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
      </span>
    </a>
  );
}

// ── Group Rejected Card ────────────────────────────────────────────────────────

function GroupRejectedCard({ notification }: { notification: Notification }) {
  const meta = getMeta(notification);
  const groupName = String(meta.groupName ?? "a group");

  return (
    <div className={cn(
      "flex items-start gap-3 rounded-2xl border p-4",
      !notification.isRead ? "border-rose-100 bg-rose-50/20" : "border-cream-dark bg-cream-paper"
    )}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-xl">😔</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">Request to {groupName} not approved</p>
        <p className="mt-0.5 text-xs text-ink-muted">Explore other public groups that match your interests.</p>
        <a href="/groups" className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-gold">
          Browse groups <ArrowRight className="h-3 w-3" />
        </a>
      </div>
      <span className="shrink-0 text-[10px] text-ink-muted">
        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
      </span>
    </div>
  );
}

// ── Achievement Card ──────────────────────────────────────────────────────────

function AchievementCard({ notification }: { notification: Notification }) {
  return (
    <div className={cn(
      "flex items-start gap-3 rounded-2xl border p-4",
      !notification.isRead ? "border-gold/40 bg-gold/8" : "border-cream-dark bg-cream-paper"
    )}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-xl">
        🏆
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">{notification.title}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{notification.body}</p>
      </div>
      <span className="shrink-0 text-[10px] text-ink-muted">
        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
      </span>
    </div>
  );
}

// ── Circle Accepted Card ──────────────────────────────────────────────────────

function CircleAcceptedCard({ notification }: { notification: Notification }) {
  const meta = getMeta(notification);
  const name = String(meta.accepterName ?? "Someone");
  const image = meta.accepterImage ? String(meta.accepterImage) : null;

  return (
    <div className={cn(
      "flex items-start gap-3 rounded-2xl border p-4 transition-colors",
      !notification.isRead ? "border-emerald-100 bg-emerald-50/30" : "border-cream-dark bg-cream-paper"
    )}>
      <SmallAvatar name={name} image={image} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">{name} accepted your request!</p>
        <p className="mt-0.5 text-xs text-ink-muted">You&apos;re now in each other&apos;s Circle. Say hello!</p>
        <a href="/circle" className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-gold">
          View Circle <ArrowRight className="h-3 w-3" />
        </a>
      </div>
      <span className="shrink-0 text-[10px] text-ink-muted">
        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
      </span>
    </div>
  );
}

// ── Standard Row ──────────────────────────────────────────────────────────────

function StandardRow({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: (id: string) => void;
}) {
  const handleClick = () => {
    if (!notification.isRead) onRead(notification.id);
    if (notification.link) window.location.href = notification.link;
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
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cream-dark text-base">
        {TYPE_EMOJI[notification.type] ?? "🔔"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight text-ink">{notification.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{notification.body}</p>
        <p className="mt-1 text-[10px] text-ink-muted">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </p>
      </div>
      {!notification.isRead && (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
      )}
    </button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
}

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const subtype = getSubtype(notification);

  if (subtype === "circle_request") {
    return <CircleRequestCard notification={notification} onRead={onRead} />;
  }
  if (subtype === "group_join_request") {
    return <GroupJoinRequestCard notification={notification} onRead={onRead} />;
  }
  if (subtype === "group_join_approved") {
    return <GroupApprovedCard notification={notification} />;
  }
  if (subtype === "group_join_rejected") {
    return <GroupRejectedCard notification={notification} />;
  }
  if (subtype === "circle_accepted") {
    return <CircleAcceptedCard notification={notification} />;
  }
  if (notification.type === "achievement_unlocked") {
    return <AchievementCard notification={notification} />;
  }

  return <StandardRow notification={notification} onRead={onRead} />;
}
