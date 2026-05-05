"use client";

// src/app/groups/community/[id]/member-checkin-grid.tsx
// Member check-in grid: shows all members with green/gray check-in status.
// Tapping a member opens a bottom sheet with their recent check-in history.

import { useState, useEffect } from "react";
import { X, CheckCircle2, Clock, Calendar, Flame } from "lucide-react";
import { cn } from "@/lib/utils/index";

interface MemberRow {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  role: string;
  streak?: number | null;
}

interface CheckInHistory {
  goalName: string;
  loggedAt: string;
  note?: string | null;
  value?: number;
}

interface MemberCheckInGridProps {
  groupId: string;
  members: MemberRow[];
  checkedInTodayIds: string[];
}

function Avatar({
  name,
  image,
  size = "md",
}: {
  name: string | null;
  image: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const inits = name
    ? name.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")
    : "?";
  const dim =
    size === "lg" ? "h-14 w-14 text-sm" : size === "md" ? "h-10 w-10 text-xs" : "h-8 w-8 text-[10px]";
  return (
    <div className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold/20 font-bold text-gold", dim)}>
      {image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={image} alt={name ?? ""} className="h-full w-full object-cover" />
        : inits}
    </div>
  );
}

function MemberHistorySheet({
  groupId,
  member,
  onClose,
}: {
  groupId: string;
  member: MemberRow;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<CheckInHistory[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/groups/${groupId}/member-checkins?userId=${member.id}`)
      .then((r) => r.json())
      .then((d: { checkIns?: CheckInHistory[] }) => {
        setHistory(d.checkIns ?? []);
      })
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [groupId, member.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-t-3xl bg-cream-paper shadow-xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-3">
          <div className="h-1 w-10 rounded-full bg-cream-dark" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pb-3 pt-4">
          <Avatar name={member.name} image={member.image} size="md" />
          <div className="flex-1 min-w-0">
            <p className="truncate font-semibold text-ink">{member.name ?? member.username ?? "Member"}</p>
            {member.username && (
              <p className="text-xs text-ink-muted">@{member.username}</p>
            )}
          </div>
          {member.streak != null && member.streak > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600">
              <Flame className="h-3 w-3" />
              {member.streak}d
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-cream-dark"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Check-ins history */}
        <div className="border-t border-cream-dark px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-ink-muted" />
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Recent Check-ins on Group Goals
            </p>
          </div>

          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-cream-dark" />
              ))}
            </div>
          ) : !history || history.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-cream-dark/40 py-8 text-center">
              <Clock className="mb-2 h-8 w-8 text-ink-muted/40" />
              <p className="text-sm font-medium text-ink-muted">No check-ins yet</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {member.name ?? "This member"} hasn&apos;t logged any group goal activity.
              </p>
            </div>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {history.map((h, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl bg-cream px-3 py-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink">{h.goalName}</p>
                    {h.note && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">{h.note}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-ink-muted">
                    {new Date(h.loggedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 pb-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl border border-cream-dark py-2.5 text-sm font-semibold text-ink-muted transition hover:bg-cream-dark"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function MemberCheckInGrid({ groupId, members, checkedInTodayIds }: MemberCheckInGridProps) {
  const [selected, setSelected] = useState<MemberRow | null>(null);
  const checkedInSet = new Set(checkedInTodayIds);

  const checkedIn = members.filter((m) => checkedInSet.has(m.id));
  const notYet = members.filter((m) => !checkedInSet.has(m.id));
  const total = members.length;
  const rate = total > 0 ? checkedIn.length / total : 0;

  return (
    <>
      {/* Grid */}
      <div className="space-y-4">
        {/* Rate summary */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-semibold text-ink">
              {checkedIn.length} of {total} checked in today
            </span>
          </div>
          <span className={cn(
            "rounded-full px-2.5 py-0.5 text-[10px] font-bold",
            rate >= 0.7 ? "bg-emerald-50 text-emerald-700"
              : rate >= 0.4 ? "bg-amber-50 text-amber-700"
              : "bg-cream-dark text-ink-muted"
          )}>
            {Math.round(rate * 100)}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 overflow-hidden rounded-full bg-cream-dark">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              rate >= 0.7 ? "bg-emerald-500" : rate >= 0.4 ? "bg-amber-400" : "bg-gold/50"
            )}
            style={{ width: `${Math.max(rate * 100, rate > 0 ? 6 : 0)}%` }}
          />
        </div>

        {/* Avatar grid */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-3">
          {/* Checked in first */}
          {checkedIn.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelected(m)}
              className="group flex flex-col items-center gap-1.5 rounded-xl p-2 transition hover:bg-cream-dark/40"
            >
              <div className="relative">
                <Avatar name={m.name} image={m.image} size="md" />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-cream-paper">
                  <svg viewBox="0 0 10 8" className="h-2 w-2 fill-none stroke-white stroke-[1.5]">
                    <path d="M1 4l2.5 2.5L9 1" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>
              <span className="line-clamp-1 max-w-[64px] text-center text-[10px] font-medium leading-tight text-ink group-hover:text-gold">
                {m.name?.split(" ")[0] ?? m.username ?? "?"}
              </span>
            </button>
          ))}

          {/* Not checked in */}
          {notYet.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelected(m)}
              className="group flex flex-col items-center gap-1.5 rounded-xl p-2 opacity-50 transition hover:opacity-80 hover:bg-cream-dark/40"
            >
              <div className="relative">
                <div className="h-10 w-10 overflow-hidden rounded-full bg-cream-dark ring-2 ring-cream-dark">
                  {m.image
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={m.image} alt={m.name ?? ""} className="h-full w-full object-cover grayscale" />
                    : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-ink-muted">
                        {m.name?.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") ?? "?"}
                      </div>
                    )
                  }
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-cream-dark ring-2 ring-cream-paper">
                  <Clock className="h-2.5 w-2.5 text-ink-muted" />
                </span>
              </div>
              <span className="line-clamp-1 max-w-[64px] text-center text-[10px] leading-tight text-ink-muted">
                {m.name?.split(" ")[0] ?? m.username ?? "?"}
              </span>
            </button>
          ))}
        </div>

        {members.length === 0 && (
          <p className="text-center text-sm text-ink-muted">No members yet.</p>
        )}
      </div>

      {/* Member history sheet */}
      {selected && (
        <MemberHistorySheet
          groupId={groupId}
          member={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
