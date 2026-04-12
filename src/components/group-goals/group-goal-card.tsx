"use client";

// src/components/group-goals/group-goal-card.tsx
// Premium group card with rank badge, creator, member stack, and progress.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crown, Lock, Clock, Users, Medal, ArrowRight } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { cn, initials, formatUnit, categoryColor } from "@/lib/utils/index";
import type {
  GroupGoalWithMembers,
  ViewerJoinRequestStatus,
} from "@/server/services/group-goals.service";

interface GroupGoalCardProps {
  group: GroupGoalWithMembers & {
    viewerJoinRequestStatus?: ViewerJoinRequestStatus;
    rank?: number;
    creatorUser?: { id: string; name: string | null; username: string | null; image: string | null } | null;
  };
  currentUserId: string;
  hideMemberDetails?: boolean;
}

function Avatar({
  name,
  image,
  size = "sm",
}: {
  name: string | null;
  image: string | null;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold font-bold text-ink",
        dim
      )}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={name ?? ""} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </div>
  );
}

function MemberAvatarStack({
  members,
}: {
  members: GroupGoalWithMembers["members"];
}) {
  const visible = members.slice(0, 4);
  const overflow = members.length - 4;
  return (
    <div className="flex items-center">
      {visible.map((m, i) => (
        <div
          key={m.id}
          className="relative inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border-2 border-cream-paper bg-gold text-[9px] font-bold text-ink"
          style={{ marginLeft: i === 0 ? 0 : -6, zIndex: visible.length - i }}
          title={m.user.name ?? "Member"}
        >
          {m.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.user.image} alt={m.user.name ?? ""} className="h-full w-full object-cover" />
          ) : (
            initials(m.user.name)
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="relative inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-cream-paper bg-cream-dark text-[9px] font-semibold text-ink-muted"
          style={{ marginLeft: -6 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-cream-paper shadow-sm">
        <Medal className="h-3 w-3" /> #1
      </span>
    );
  if (rank === 2)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-ink-muted/80 px-2 py-0.5 text-[10px] font-bold text-cream-paper shadow-sm">
        <Medal className="h-3 w-3" /> #2
      </span>
    );
  if (rank === 3)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose/80 px-2 py-0.5 text-[10px] font-bold text-cream-paper shadow-sm">
        <Medal className="h-3 w-3" /> #3
      </span>
    );
  if (rank <= 10)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-cream-dark px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
        #{rank}
      </span>
    );
  return null;
}

export function GroupGoalCard({
  group,
  currentUserId,
  hideMemberDetails = false,
}: GroupGoalCardProps) {
  const router = useRouter();
  const [requestBusy, setRequestBusy] = useState(false);
  const accentColor = group.color ?? categoryColor(group.category);
  const requestPending = group.viewerJoinRequestStatus === "pending";
  const creator = group.creatorUser ?? group.members.find((m) => m.role === "creator")?.user ?? null;

  async function handleRequestToJoin() {
    setRequestBusy(true);
    try {
      const response = await fetch(`/api/group-goals/${group.id}/join`, { method: "POST" });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to request access");
      }
      toast("Join request sent. Waiting on owner approval.", "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to request access", "error");
    } finally {
      setRequestBusy(false);
    }
  }

  return (
    <div className="group/card relative flex flex-col overflow-hidden rounded-2xl border border-cream-dark bg-cream-paper shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
      {/* Gradient header */}
      <div
        className="relative h-24 w-full overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${accentColor}22 0%, ${accentColor}44 100%)`,
          borderBottom: `1px solid ${accentColor}33`,
        }}
      >
        {/* Accent stripe */}
        <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: accentColor }} />

        {/* Emoji */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl shadow-sm"
            style={{ background: `${accentColor}22`, border: `1.5px solid ${accentColor}44` }}
          >
            {group.emoji ?? "⭐"}
          </div>
        </div>

        {/* Top-right badges */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {group.rank && group.rank <= 10 && <RankBadge rank={group.rank} />}
          {hideMemberDetails && (
            <span className="inline-flex items-center gap-1 rounded-full bg-cream-paper/90 px-2 py-0.5 text-[10px] font-medium text-ink-muted backdrop-blur-sm">
              <Lock className="h-2.5 w-2.5" />
              {group.isPublic ? "Open" : "Private"}
            </span>
          )}
        </div>

        {/* Completion badge */}
        {!hideMemberDetails && group.percentComplete > 0 && (
          <div className="absolute bottom-2 right-3">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: `${accentColor}22`, color: accentColor }}
            >
              {group.percentComplete}%
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        {/* Category */}
        <p className="section-label mb-1">{group.category}</p>

        {/* Title */}
        <Link
          href={`/groups/${group.id}`}
          className="block font-serif text-[1.0625rem] font-semibold leading-snug text-ink transition-colors hover:text-gold"
        >
          {group.title}
        </Link>

        {/* Description */}
        {group.description && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">
            {group.description}
          </p>
        )}

        {/* Creator */}
        {creator && (
          <div className="mt-2.5 flex items-center gap-1.5">
            <Crown className="h-3 w-3 text-gold" />
            <span className="text-xs text-ink-muted">
              by{" "}
              {creator.username ? (
                <Link
                  href={`/profile/${creator.username}`}
                  className="font-medium text-ink hover:text-gold hover:underline"
                >
                  {creator.name ?? `@${creator.username}`}
                </Link>
              ) : (
                <span className="font-medium text-ink">{creator.name ?? "Creator"}</span>
              )}
            </span>
          </div>
        )}

        {/* Progress bar */}
        {!hideMemberDetails && group.targetValue && group.percentComplete > 0 && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[10px] text-ink-muted">
              <span>{formatUnit(group.currentValue, group.unit)}</span>
              <span>{formatUnit(group.targetValue, group.unit)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-cream-dark">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${group.percentComplete}%`, background: accentColor }}
              />
            </div>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-cream-dark pt-3">
          <div className="flex items-center gap-3">
            {!hideMemberDetails && group.members.length > 0 ? (
              <MemberAvatarStack members={group.members} />
            ) : null}
            <span className="flex items-center gap-1 text-xs text-ink-muted">
              <Users className="h-3 w-3" />
              {group.memberCount}
            </span>
            {group.daysLeft !== null && (
              <span className="flex items-center gap-1 text-xs text-ink-muted">
                <Clock className="h-3 w-3" />
                {group.daysLeft > 0 ? `${group.daysLeft}d` : "Ended"}
              </span>
            )}
          </div>

          {hideMemberDetails ? (
            <button
              type="button"
              onClick={() => void handleRequestToJoin()}
              disabled={requestBusy || requestPending}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                requestPending
                  ? "bg-cream-dark text-ink-muted"
                  : "bg-ink text-cream-paper hover:opacity-90"
              )}
            >
              {requestPending ? "Pending" : requestBusy ? "…" : "Request to Join"}
            </button>
          ) : (
            <Link
              href={`/groups/${group.id}`}
              className="inline-flex items-center justify-center rounded-full bg-cream-dark px-3 py-1.5 text-sm font-semibold text-gold transition-all hover:bg-ink hover:text-cream-paper"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {/* Join request pending badge */}
        {group.viewerJoinRequestStatus === "pending" && hideMemberDetails && (
          <p className="mt-2 text-center text-[10px] text-ink-muted">
            Request pending · waiting on owner approval
          </p>
        )}
      </div>
    </div>
  );
}
