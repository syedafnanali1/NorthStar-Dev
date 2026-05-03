"use client";

// src/app/circle/circle-feed.tsx — Full Circle Flow matching spec §08

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus, Search, X, Check, Clock, Bell,
  MoreHorizontal, Users, Share2, ChevronRight,
  Flame, Target, Trophy, AlertTriangle,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import { FriendCelebration } from "@/components/circle/friend-celebration";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CircleMember {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  streak: number;
  momentumScore: number;
  totalGoalsCompleted: number;
  jobTitle: string | null;
  location: string | null;
  checkedInToday: boolean;
  lastLog: { date: string; mood: string | null; completedTaskIds: string[] } | null;
}

interface SuggestedPerson {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  streak: number;
  momentumScore: number;
  totalGoalsCompleted: number;
}

interface PendingRequest {
  connectionId: string;
  direction: "incoming" | "outgoing";
  createdAt: Date;
  user: { id: string; name: string | null; username: string | null; image: string | null };
}

interface UserGoal {
  id: string;
  title: string;
  emoji: string | null;
  color: string;
  isPublic: boolean;
}

interface CircleFeedProps {
  currentUserId: string;
  currentUserName: string;
  circleMembers: CircleMember[];
  userGoals: UserGoal[];
  pendingRequests: PendingRequest[];
  suggestedPeople: SuggestedPerson[];
  activeToday: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ["#C4963A", "#6B8C7A", "#5B7EA6", "#B5705B", "#7B6FA0", "#4A8C8C"];

function avatarColor(name: string | null): string {
  if (!name) return AVATAR_COLORS[0]!;
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]!;
}

function lastActivityLabel(member: CircleMember): { text: string; color: string } {
  if (member.checkedInToday) return { text: "Checked in today ✓", color: "text-emerald-600" };
  if (!member.lastLog) {
    return { text: member.streak > 0 ? `🔥 ${member.streak}-day streak` : "No recent activity", color: "text-ink-muted" };
  }
  const logDate = new Date(member.lastLog.date + "T00:00:00");
  const diffDays = Math.floor((Date.now() - logDate.getTime()) / 86400000);
  if (diffDays === 1) return { text: "Checked in yesterday", color: "text-ink-muted" };
  if (diffDays <= 7) return { text: `Last active ${diffDays}d ago`, color: "text-ink-muted" };
  return { text: "No recent activity", color: "text-ink-muted" };
}

function Avatar({
  name, image, size = "md", color,
}: { name: string | null; image: string | null; size?: "sm" | "md" | "lg"; color?: string }) {
  const bg = color ?? avatarColor(name);
  const sizeClass = { sm: "h-8 w-8 text-[10px]", md: "h-11 w-11 text-sm", lg: "h-16 w-16 text-base" }[size];
  return (
    <div
      className={cn("flex flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl font-bold text-white", sizeClass)}
      style={{ background: bg }}
    >
      {image
        ? <img src={image} alt={name ?? ""} className="h-full w-full object-cover" />
        : initials(name)}
    </div>
  );
}

// ─── MemberProfileSheet ───────────────────────────────────────────────────────

function MemberProfileSheet({
  member,
  userGoals,
  onClose,
  onCheer,
  onNudge,
  nudgedIds,
  onRemoved,
}: {
  member: CircleMember;
  userGoals: UserGoal[];
  onClose: () => void;
  onCheer: (id: string, name: string) => void;
  onNudge: (id: string, name: string) => void;
  nudgedIds: Set<string>;
  onRemoved: (id: string) => void;
}) {
  const [showMenu, setShowMenu]       = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving]       = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName = member.name ?? `@${member.username}`;
  const isNudged = nudgedIds.has(member.id);
  const sharedGoals = userGoals.filter((g) => g.isPublic);
  const { text: activityText, color: activityColor } = lastActivityLabel(member);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    if (showMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await fetch("/api/circle/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id }),
      });
      toast(`${displayName} removed from your circle`);
      onRemoved(member.id);
      onClose();
    } catch {
      toast("Failed to remove", "error");
      setRemoving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-end bg-[rgba(26,23,20,0.55)] backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full overflow-hidden rounded-t-3xl bg-cream-paper sm:max-w-sm sm:rounded-3xl"
        style={{ maxHeight: "min(680px, calc(100dvh - 60px))" }}>

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-cream-dark" />
        </div>

        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-2">
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-cream-dark text-ink-muted hover:text-ink">
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="relative" ref={menuRef}>
            <button type="button" onClick={() => setShowMenu((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-cream-dark text-ink-muted hover:text-ink">
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-10 z-10 min-w-[180px] rounded-2xl border border-cream-dark bg-cream-paper py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => { setShowMenu(false); setConfirmRemove(true); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-rose hover:bg-cream transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Remove from circle
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-y-auto overscroll-contain px-5 pb-8"
          style={{ maxHeight: "calc(min(680px, 100dvh - 60px) - 80px)" }}>

          {/* Avatar + name */}
          <div className="flex flex-col items-center pb-5 pt-1 text-center">
            <div className="relative">
              <Avatar name={member.name} image={member.image} size="lg" />
              {member.checkedInToday && (
                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-cream-paper bg-emerald-500">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </div>
              )}
            </div>
            <h2 className="mt-3 font-serif text-xl font-semibold text-ink">{displayName}</h2>
            {member.username && (
              <p className="text-sm text-ink-muted">@{member.username}</p>
            )}
            {(member.jobTitle ?? member.location) && (
              <p className="mt-1 text-xs text-ink-muted">
                {[member.jobTitle, member.location].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className={cn("mt-2 text-xs font-medium", activityColor)}>{activityText}</p>

            {/* Cheer + Nudge */}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => { onCheer(member.id, displayName); onClose(); }}
                className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-5 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-500/18 active:scale-95"
              >
                🎉 Cheer
              </button>
              <button
                type="button"
                disabled={isNudged || member.checkedInToday}
                onClick={() => { if (!isNudged && !member.checkedInToday) { onNudge(member.id, displayName); onClose(); } }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold transition active:scale-95",
                  isNudged || member.checkedInToday
                    ? "bg-cream-dark text-ink-muted cursor-default opacity-50"
                    : "bg-amber-500/10 text-amber-700 hover:bg-amber-500/18"
                )}
              >
                🔔 {isNudged ? "Nudged" : "Nudge"}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 pb-5">
            {[
              { icon: <Flame className="h-4 w-4 text-amber-500" />, value: member.streak, label: "Day Streak" },
              { icon: <Trophy className="h-4 w-4 text-gold" />, value: member.totalGoalsCompleted, label: "Goals Done" },
              { icon: <Target className="h-4 w-4 text-ink-muted" />, value: member.momentumScore, label: "Momentum" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-cream-dark bg-cream px-2 py-3 text-center">
                <div className="flex justify-center mb-1">{s.icon}</div>
                <p className="font-serif text-lg font-semibold text-ink">{s.value}</p>
                <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-muted mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Shared Goals */}
          {sharedGoals.length > 0 && (
            <div className="pb-5">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                Shared Goals
              </p>
              <div className="space-y-2">
                {sharedGoals.slice(0, 4).map((goal) => (
                  <div key={goal.id}
                    className="flex items-center gap-3 rounded-2xl border border-cream-dark bg-cream px-3.5 py-2.5">
                    <span className="text-base leading-none">{goal.emoji ?? "⭐"}</span>
                    <p className="flex-1 truncate text-sm font-medium text-ink">{goal.title}</p>
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-cream-dark">
                      <div className="h-full rounded-full" style={{ width: "45%", background: goal.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent activity */}
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              Recent Activity
            </p>
            <div className="space-y-2">
              {member.checkedInToday && (
                <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500">
                    <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                  </span>
                  <p className="text-sm text-emerald-700 font-medium">Checked in today</p>
                </div>
              )}
              {member.streak > 0 && (
                <div className="flex items-center gap-2.5 rounded-2xl border border-cream-dark bg-cream px-3.5 py-2.5">
                  <span className="text-base">🔥</span>
                  <p className="text-sm text-ink"><span className="font-semibold">{member.streak}-day</span> streak</p>
                </div>
              )}
              {member.lastLog && (
                <div className="flex items-center gap-2.5 rounded-2xl border border-cream-dark bg-cream px-3.5 py-2.5">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-ink/8">
                    <Clock className="h-2.5 w-2.5 text-ink-muted" />
                  </span>
                  <p className="text-sm text-ink-muted">
                    Last log: <span className="font-medium text-ink">{member.lastLog.date}</span>
                    {member.lastLog.completedTaskIds.length > 0 && (
                      <span className="ml-1.5 text-gold">· {member.lastLog.completedTaskIds.length} task{member.lastLog.completedTaskIds.length > 1 ? "s" : ""}</span>
                    )}
                  </p>
                </div>
              )}
              {!member.checkedInToday && member.streak === 0 && !member.lastLog && (
                <div className="rounded-2xl border border-dashed border-cream-dark px-4 py-4 text-center">
                  <p className="text-sm text-ink-muted">No activity yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </div>

      {/* Confirm remove modal */}
      {confirmRemove && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-[rgba(26,23,20,0.5)]">
          <div className="w-full max-w-xs rounded-3xl bg-cream-paper p-6 shadow-xl">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose/10">
                <AlertTriangle className="h-6 w-6 text-rose" />
              </div>
            </div>
            <h3 className="text-center font-serif text-lg font-semibold text-ink mb-2">
              Remove from circle?
            </h3>
            <p className="text-center text-sm text-ink-muted mb-6">
              {displayName} will be removed from your accountability circle. They won&apos;t see your goals or check-ins.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmRemove(false)}
                className="flex-1 rounded-2xl border border-cream-dark bg-cream px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-cream-dark">
                Cancel
              </button>
              <button type="button" onClick={() => void handleRemove()} disabled={removing}
                className="flex-1 rounded-2xl bg-rose px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
                {removing ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MemberRow ────────────────────────────────────────────────────────────────

function MemberRow({
  member,
  onViewProfile,
  onCheer,
  onNudge,
  nudgedIds,
}: {
  member: CircleMember;
  onViewProfile: (member: CircleMember) => void;
  onCheer: (id: string, name: string) => void;
  onNudge: (id: string, name: string) => void;
  nudgedIds: Set<string>;
}) {
  const displayName = member.name?.split(" ")[0] ?? `@${member.username}`;
  const { text: activityText, color: activityColor } = lastActivityLabel(member);
  const isNudged = nudgedIds.has(member.id);

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-cream/60 transition-colors">
      {/* Avatar */}
      <button type="button" onClick={() => onViewProfile(member)} className="relative flex-shrink-0">
        <Avatar name={member.name} image={member.image} size="md" />
        {member.checkedInToday && (
          <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-cream-paper bg-emerald-500">
            <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
          </div>
        )}
      </button>

      {/* Info */}
      <button type="button" onClick={() => onViewProfile(member)} className="min-w-0 flex-1 text-left">
        <p className="text-sm font-semibold text-ink">{member.name ?? `@${member.username}`}</p>
        <p className={cn("text-xs mt-0.5 truncate font-medium", activityColor)}>
          {activityText}
          {member.streak > 1 && !member.checkedInToday && (
            <span className="ml-1.5 text-amber-500">🔥 {member.streak}</span>
          )}
        </p>
      </button>

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCheer(member.id, displayName); }}
          className="flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-500/18 active:scale-95"
        >
          🎉 <span className="hidden sm:inline">Cheer</span>
        </button>
        <button
          type="button"
          disabled={isNudged || member.checkedInToday}
          onClick={(e) => { e.stopPropagation(); if (!isNudged && !member.checkedInToday) onNudge(member.id, displayName); }}
          className={cn(
            "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95",
            isNudged || member.checkedInToday
              ? "bg-cream-dark text-ink-muted cursor-default opacity-50"
              : "bg-amber-500/10 text-amber-700 hover:bg-amber-500/18"
          )}
        >
          🔔 <span className="hidden sm:inline">{isNudged ? "Sent" : "Nudge"}</span>
        </button>
      </div>
    </div>
  );
}

// ─── SharedGoalsSection ───────────────────────────────────────────────────────

function SharedGoalsSection({ goals, members }: { goals: UserGoal[]; members: CircleMember[] }) {
  const publicGoals = goals.filter((g) => g.isPublic);
  if (publicGoals.length === 0 || members.length === 0) return null;

  return (
    <div className="border-t border-cream-dark px-4 pt-4 pb-3">
      <p className="section-label mb-3">Shared Goals</p>
      <div className="space-y-2.5">
        {publicGoals.slice(0, 4).map((goal) => (
          <div key={goal.id} className="flex items-center gap-3 rounded-2xl border border-cream-dark bg-cream px-3.5 py-2.5">
            <span className="text-base leading-none flex-shrink-0">{goal.emoji ?? "⭐"}</span>
            <p className="flex-1 truncate text-sm font-medium text-ink">{goal.title}</p>
            <div className="flex flex-shrink-0 -space-x-1.5">
              {members.slice(0, 3).map((m) => (
                <div
                  key={m.id}
                  title={m.name ?? m.username ?? ""}
                  className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border-2 border-cream-paper text-[8px] font-bold text-white"
                  style={{ background: avatarColor(m.name) }}
                >
                  {m.image ? <img src={m.image} alt="" className="h-full w-full object-cover" /> : initials(m.name)}
                </div>
              ))}
              {members.length > 3 && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-cream-paper bg-ink text-[7px] font-bold text-cream-paper">
                  +{members.length - 3}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PendingSection ───────────────────────────────────────────────────────────

function PendingSection({
  requests,
  onAccepted,
}: {
  requests: PendingRequest[];
  onAccepted: (name: string) => void;
}) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  const incoming = requests.filter((r) => r.direction === "incoming" && !dismissed.has(r.connectionId));
  const outgoing = requests.filter((r) => r.direction === "outgoing" && !dismissed.has(r.connectionId));
  if (incoming.length === 0 && outgoing.length === 0) return null;

  const respond = async (connectionId: string, action: "accept" | "decline", name: string) => {
    if (processing.has(connectionId)) return;
    setProcessing((s) => new Set(s).add(connectionId));
    try {
      const res = await fetch(`/api/friends/requests/${connectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error();
      setDismissed((s) => new Set(s).add(connectionId));
      if (action === "accept") { toast(`Connected with ${name} ✓`); onAccepted(name); router.refresh(); }
      else toast("Request declined");
    } catch {
      toast("Failed to respond", "error");
    } finally {
      setProcessing((s) => { const n = new Set(s); n.delete(connectionId); return n; });
    }
  };

  const cancel = async (connectionId: string, name: string) => {
    if (processing.has(connectionId)) return;
    setProcessing((s) => new Set(s).add(connectionId));
    try {
      await fetch(`/api/friends/requests/${connectionId}`, { method: "DELETE" });
      setDismissed((s) => new Set(s).add(connectionId));
      toast(`Invite to ${name} cancelled`);
    } catch {
      toast("Failed to cancel", "error");
    } finally {
      setProcessing((s) => { const n = new Set(s); n.delete(connectionId); return n; });
    }
  };

  return (
    <div className="border-t border-cream-dark px-4 pt-4 pb-3 space-y-3">
      {incoming.length > 0 && (
        <div>
          <p className="section-label mb-3 text-gold">
            {incoming.length} Circle Request{incoming.length > 1 ? "s" : ""}
          </p>
          <div className="space-y-2">
            {incoming.map((req) => {
              const name = req.user.name ?? `@${req.user.username}`;
              const busy = processing.has(req.connectionId);
              return (
                <div key={req.connectionId} className="flex items-center gap-3 rounded-2xl border border-gold/25 bg-gold/5 px-3.5 py-2.5">
                  <Avatar name={req.user.name} image={req.user.image} size="sm" color="#C4963A" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{name}</p>
                    <p className="text-xs text-ink-muted">wants to join your circle</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button type="button" disabled={busy} onClick={() => void respond(req.connectionId, "decline", name)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-cream-dark bg-cream text-ink-muted transition hover:text-rose disabled:opacity-40">
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" disabled={busy} onClick={() => void respond(req.connectionId, "accept", name)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink text-cream-paper transition hover:opacity-80 disabled:opacity-40">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {outgoing.length > 0 && (
        <div>
          <p className="section-label mb-3">Pending Invites</p>
          <div className="space-y-2">
            {outgoing.map((req) => {
              const name = req.user.name ?? `@${req.user.username}`;
              const busy = processing.has(req.connectionId);
              return (
                <div key={req.connectionId} className="flex items-center gap-3 rounded-2xl border border-cream-dark bg-cream px-3.5 py-2.5">
                  <Avatar name={req.user.name} image={req.user.image} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{name}</p>
                    <p className="text-xs text-ink-muted flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Invite sent · pending
                    </p>
                  </div>
                  <button type="button" disabled={busy} onClick={() => void cancel(req.connectionId, name)}
                    className="text-xs font-medium text-rose hover:opacity-80 transition disabled:opacity-40 px-2 py-1">
                    Cancel
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SuggestionCard ───────────────────────────────────────────────────────────

function SuggestionCard({
  person, onAdd, added,
}: { person: SuggestedPerson; onAdd: (id: string, name: string) => void; added: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-cream-dark bg-cream-paper px-3.5 py-3 transition-all hover:shadow-sm">
      <Avatar name={person.name} image={person.image} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{person.name ?? `@${person.username}`}</p>
        <p className="text-xs text-ink-muted">
          {person.streak > 0 ? `🔥 ${person.streak}-day streak` : `${person.totalGoalsCompleted} goals completed`}
        </p>
      </div>
      {added ? (
        <span className="flex-shrink-0 flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600">
          <Check className="h-3 w-3" /> Sent
        </span>
      ) : (
        <button type="button" onClick={() => onAdd(person.id, person.name ?? person.username ?? "them")}
          className="flex flex-shrink-0 items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-cream-paper transition hover:opacity-80 active:scale-95">
          <UserPlus className="h-3 w-3" /> Add
        </button>
      )}
    </div>
  );
}

// ─── InviteSheet ──────────────────────────────────────────────────────────────

function InviteSheet({
  open,
  onClose,
  onConnected,
  currentUserId,
}: {
  open: boolean;
  onClose: () => void;
  onConnected: (name: string) => void;
  currentUserId: string;
}) {
  const [query, setQuery]   = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) { setQuery(""); setResults([]); setTimeout(() => inputRef.current?.focus(), 80); }
  }, [open]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (query.length < 2) { setResults([]); return; }
      setLoading(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { users: SearchUser[] };
        setResults(data.users);
      } catch { /* silent */ } finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSend = async (user: SearchUser) => {
    if (pendingIds.has(user.id)) return;
    setPendingIds((p) => new Set(p).add(user.id));
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username ?? undefined }),
      });
      const data = (await res.json()) as { status?: string; error?: string };
      if (!res.ok) { toast(data.error ?? "Failed", "error"); setPendingIds((p) => { const s = new Set(p); s.delete(user.id); return s; }); return; }
      const name = user.name ?? user.username ?? "them";
      if (data.status === "accepted" || data.status === "already_friends") {
        toast("Connected ✓"); onConnected(name);
        setResults((r) => r.map((u) => u.id === user.id ? { ...u, connection: { connectionId: "", status: "accepted", direction: "sent" } } : u));
      } else {
        toast(`Invite sent to ${name} ✓`);
        setResults((r) => r.map((u) => u.id === user.id ? { ...u, connection: { connectionId: "", status: "pending", direction: "sent" } } : u));
      }
    } catch {
      toast("Failed to send", "error");
      setPendingIds((p) => { const s = new Set(p); s.delete(user.id); return s; });
    }
  };

  const handleShareLink = async () => {
    setSharing(true);
    try {
      const link = `${window.location.origin}/invite?ref=${currentUserId}`;
      if (navigator.share) {
        await navigator.share({ title: "Join my NorthStar circle", text: "I'm using NorthStar to track my goals — join my accountability circle!", url: link });
      } else {
        await navigator.clipboard.writeText(link);
        toast("Invite link copied! 🔗");
      }
    } catch { /* user cancelled share */ } finally { setSharing(false); }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end bg-[rgba(26,23,20,0.55)] backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full rounded-t-3xl bg-cream-paper sm:max-w-lg sm:rounded-3xl"
        style={{ maxHeight: "min(580px, calc(100dvh - 60px))" }}>

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-cream-dark" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-cream-dark px-5 py-3">
          <p className="flex-1 font-serif text-base font-semibold text-ink">Invite to Circle</p>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-cream-dark text-ink-muted hover:text-ink">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Share link */}
        <div className="px-5 py-3 border-b border-cream-dark">
          <button type="button" onClick={() => void handleShareLink()} disabled={sharing}
            className="flex w-full items-center gap-3 rounded-2xl border border-ink/20 bg-ink px-4 py-2.5 text-sm font-semibold text-cream-paper transition hover:opacity-80 active:scale-[0.98] disabled:opacity-60">
            <Share2 className="h-4 w-4" />
            {sharing ? "Sharing…" : "Share invite link"}
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 border-b border-cream-dark px-5 py-3">
          <Search className="h-4 w-4 flex-shrink-0 text-ink-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by @username or name…"
            className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="text-ink-muted hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="overflow-y-auto overscroll-contain"
          style={{ maxHeight: "min(300px, calc(100dvh - 260px))" }}>
          {loading && <div className="py-6 text-center text-sm text-ink-muted">Searching…</div>}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-2xl mb-2">🔍</p>
              <p className="text-sm text-ink-muted">No users found for &ldquo;{query}&rdquo;</p>
            </div>
          )}
          {!loading && query.length < 2 && (
            <div className="py-6 text-center text-sm text-ink-muted">Type at least 2 characters to search</div>
          )}
          <div className="divide-y divide-cream-dark">
            {results.map((user) => {
              const conn = user.connection;
              return (
                <div key={user.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={user.name} image={user.image} size="sm" color="#C4963A" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{user.name ?? `@${user.username}`}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {user.username ? `@${user.username}` : ""}
                      {user.currentStreak > 0 && ` · 🔥 ${user.currentStreak}`}
                    </p>
                  </div>
                  {!conn ? (
                    <button type="button" disabled={pendingIds.has(user.id)} onClick={() => void handleSend(user)}
                      className="flex h-8 items-center gap-1.5 rounded-xl bg-ink px-3 text-xs font-semibold text-cream-paper transition hover:opacity-80 disabled:opacity-50">
                      <UserPlus className="h-3 w-3" /> Invite
                    </button>
                  ) : conn.status === "accepted" ? (
                    <span className="flex h-8 items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-600">
                      <Check className="h-3 w-3" /> In circle
                    </span>
                  ) : conn.status === "pending" && conn.direction === "sent" ? (
                    <span className="flex h-8 items-center gap-1 rounded-xl border border-cream-dark bg-cream px-3 text-xs font-semibold text-ink-muted">
                      <Clock className="h-3 w-3" /> Pending
                    </span>
                  ) : conn.status === "pending" && conn.direction === "received" ? (
                    <button type="button" onClick={() => void handleSend(user)}
                      className="flex h-8 items-center gap-1.5 rounded-xl border border-gold/40 bg-gold/10 px-3 text-xs font-semibold text-gold transition hover:bg-gold/20">
                      <Check className="h-3 w-3" /> Accept
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </div>
    </div>
  );
}

// SearchUser type for InviteSheet
interface SearchUser {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  currentStreak: number;
  connection: { connectionId: string; status: string; direction: "sent" | "received" } | null;
}

// ─── Main CircleFeed ──────────────────────────────────────────────────────────

export function CircleFeed({
  currentUserId,
  currentUserName,
  circleMembers: initialMembers,
  userGoals,
  pendingRequests,
  suggestedPeople,
  activeToday,
}: CircleFeedProps) {
  const router = useRouter();

  const [members, setMembers]           = useState(initialMembers);
  const [inviteOpen, setInviteOpen]     = useState(false);
  const [profileMember, setProfileMember] = useState<CircleMember | null>(null);
  const [celebOpen, setCelebOpen]       = useState(false);
  const [celebName, setCelebName]       = useState("");
  const [addedIds, setAddedIds]         = useState<Set<string>>(new Set());

  const [nudgedIds, setNudgedIds] = useState<Set<string>>(() => {
    try {
      const today = new Date().toISOString().split("T")[0]!;
      const raw = localStorage.getItem(`nudged_${today}`);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch { return new Set(); }
  });

  const handleConnected = useCallback((name: string) => {
    setCelebName(name);
    setCelebOpen(true);
    router.refresh();
  }, [router]);

  const handleCheer = async (targetId: string, name: string) => {
    try {
      await fetch("/api/circle/cheer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId }),
      });
      toast(`Cheer sent to ${name}! 🎉`);
    } catch { toast("Failed to send cheer", "error"); }
  };

  const handleNudge = async (targetId: string, name: string) => {
    try {
      const res = await fetch("/api/circle/nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId }),
      });
      const data = (await res.json()) as { alreadyNudged?: boolean };
      if (data.alreadyNudged) { toast(`Already nudged ${name} today`); return; }
      toast(`Nudge sent to ${name}! 🔔`);
      setNudgedIds((prev) => {
        const next = new Set(prev).add(targetId);
        try {
          const today = new Date().toISOString().split("T")[0]!;
          localStorage.setItem(`nudged_${today}`, JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });
    } catch { toast("Failed to send nudge", "error"); }
  };

  const handleAddSuggestion = async (targetId: string, name: string) => {
    try {
      const user = suggestedPeople.find((p) => p.id === targetId);
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user?.username ?? undefined }),
      });
      if (!res.ok) throw new Error();
      toast(`Invite sent to ${name} ✓`);
      setAddedIds((prev) => new Set(prev).add(targetId));
    } catch { toast("Failed to send invite", "error"); }
  };

  const handleMemberRemoved = (memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  const totalMembers = members.length;

  return (
    <>
      {/* ── Modals ──────────────────────────────────────────────── */}
      <InviteSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onConnected={handleConnected}
        currentUserId={currentUserId}
      />

      {profileMember && (
        <MemberProfileSheet
          member={profileMember}
          userGoals={userGoals}
          onClose={() => setProfileMember(null)}
          onCheer={handleCheer}
          onNudge={handleNudge}
          nudgedIds={nudgedIds}
          onRemoved={handleMemberRemoved}
        />
      )}

      <FriendCelebration
        isOpen={celebOpen}
        onClose={() => setCelebOpen(false)}
        friendName={celebName}
      />

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="section-label">Accountability</p>
          <h1 className="mt-1 font-serif text-3xl text-ink sm:text-4xl">My Circle</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {totalMembers} member{totalMembers !== 1 ? "s" : ""}
            {activeToday > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {activeToday} active today
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-bold text-ink transition hover:opacity-90 active:scale-95"
        >
          <UserPlus className="h-3.5 w-3.5" />
          + Invite
        </button>
      </div>

      {/* ── Circle members panel ─────────────────────────────────── */}
      <div className="panel-shell overflow-hidden mb-5">
        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-cream-dark px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-ink-muted" />
            <p className="text-sm font-semibold text-ink">My Accountability Circle</p>
            {totalMembers > 0 && (
              <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-cream-paper">
                {totalMembers}
              </span>
            )}
          </div>
          <button type="button" onClick={() => setInviteOpen(true)}
            className="text-xs font-semibold text-gold hover:opacity-80 transition-colors">
            + Add member
          </button>
        </div>

        {/* Member list */}
        {members.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gold/10">
              <Users className="h-7 w-7 text-gold" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Your circle is empty</p>
              <p className="mt-1 text-xs text-ink-muted">Invite people to hold each other accountable.</p>
            </div>
            <button type="button" onClick={() => setInviteOpen(true)}
              className="mt-1 flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-bold text-ink transition hover:opacity-90">
              <UserPlus className="h-3.5 w-3.5" />
              Invite your first friend
            </button>
          </div>
        ) : (
          <div className="divide-y divide-cream-dark/60">
            {members.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                onViewProfile={setProfileMember}
                onCheer={(id, name) => void handleCheer(id, name)}
                onNudge={(id, name) => void handleNudge(id, name)}
                nudgedIds={nudgedIds}
              />
            ))}
          </div>
        )}

        {/* Shared goals */}
        <SharedGoalsSection goals={userGoals} members={members} />

        {/* Pending requests inline */}
        <PendingSection requests={pendingRequests} onAccepted={handleConnected} />
      </div>

      {/* Privacy notice */}
      <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-cream-dark bg-cream px-4 py-3">
        <span className="mt-0.5 text-sm">🔒</span>
        <p className="text-xs text-ink-muted leading-relaxed">
          Circle members can see your <span className="font-medium text-ink">goal names, check-in status, and streak</span>.
          They cannot see your notes, photos, or mood ratings.
        </p>
      </div>

      {/* ── People you may know ─────────────────────────────────── */}
      {suggestedPeople.length > 0 && (
        <div className="mb-5">
          <p className="section-label mb-3">People You May Know</p>
          <div className="space-y-2">
            {suggestedPeople.map((person) => (
              <SuggestionCard
                key={person.id}
                person={person}
                onAdd={(id, name) => void handleAddSuggestion(id, name)}
                added={addedIds.has(person.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── How it works (empty state) ───────────────────────────── */}
      {members.length === 0 && suggestedPeople.length === 0 && (
        <div className="panel-shell p-6 text-center">
          <p className="text-3xl mb-3">🌟</p>
          <p className="text-sm font-semibold text-ink mb-4">How Circle works</p>
          <div className="space-y-3 text-left max-w-xs mx-auto">
            {[
              { step: "1", text: "Invite friends via username or share your invite link" },
              { step: "2", text: "They accept and appear in your accountability circle" },
              { step: "3", text: "See each other's goals, check-ins, and streaks" },
              { step: "4", text: "Cheer and nudge to keep momentum going" },
            ].map((s) => (
              <div key={s.step} className="flex items-start gap-3">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-ink mt-0.5">
                  {s.step}
                </span>
                <p className="text-sm text-ink-muted">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
