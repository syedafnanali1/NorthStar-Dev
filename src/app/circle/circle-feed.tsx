"use client";

// src/app/circle/circle-feed.tsx
// Circle Home Screen matching spec §08:
//   - Member list: avatar + check-in badge + name + last activity + Cheer/Nudge actions
//   - Shared goals section with member completion chips
//   - People you may know suggestions
//   - Pending invite requests (incoming + outgoing)
//   - Invite sheet (username / phone search)

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Search, X, Check, Clock, Bell, ChevronRight, MoreHorizontal, Users } from "lucide-react";
import { cn, initials, relativeTime } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import { UserSearchModal } from "@/components/circle/user-search-modal";
import { UserProfileModal } from "@/components/circle/user-profile-modal";
import { FriendCelebration } from "@/components/circle/friend-celebration";
import { PendingRequestsPanel } from "@/components/circle/pending-requests-panel";

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ["#C4963A", "#6B8C7A", "#5B7EA6", "#B5705B", "#7B6FA0", "#4A8C8C"];

function avatarColor(name: string | null): string {
  if (!name) return AVATAR_COLORS[0]!;
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]!;
}

function lastActivityLabel(member: CircleMember): string {
  if (member.checkedInToday) return "Checked in today";
  if (!member.lastLog) return member.streak > 0 ? `🔥 ${member.streak}-day streak` : "No recent activity";
  const date = member.lastLog.date;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const logDate = new Date(date + "T00:00:00");
  const diffDays = Math.floor((Date.now() - logDate.getTime()) / 86400000);
  if (diffDays === 1) return "Checked in yesterday";
  if (diffDays <= 7) return `Checked in ${diffDays}d ago`;
  return "No recent activity";
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
  onViewProfile: (id: string) => void;
  onCheer: (id: string, name: string) => void;
  onNudge: (id: string, name: string) => void;
  nudgedIds: Set<string>;
}) {
  const color = avatarColor(member.name);
  const displayName = member.name?.split(" ")[0] ?? `@${member.username}`;
  const activity = lastActivityLabel(member);
  const isNudged = nudgedIds.has(member.id);

  return (
    <div className="flex items-center gap-3 py-3.5 px-4 transition-colors hover:bg-cream/60 rounded-xl">
      {/* Avatar + check badge */}
      <button
        type="button"
        onClick={() => onViewProfile(member.id)}
        className="relative flex-shrink-0"
      >
        <div
          className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl text-sm font-bold text-white"
          style={{ background: color }}
        >
          {member.image
            ? <img src={member.image} alt={member.name ?? ""} className="h-full w-full object-cover" />
            : initials(member.name)
          }
        </div>
        {member.checkedInToday && (
          <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-cream-paper bg-emerald-500">
            <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
          </div>
        )}
      </button>

      {/* Info */}
      <button
        type="button"
        onClick={() => onViewProfile(member.id)}
        className="min-w-0 flex-1 text-left"
      >
        <p className="text-sm font-semibold text-ink">
          {member.name ?? `@${member.username}`}
        </p>
        <p className={cn(
          "text-xs mt-0.5 truncate",
          member.checkedInToday ? "text-emerald-600 font-medium" : "text-ink-muted"
        )}>
          {activity}
          {member.streak > 0 && !member.checkedInToday && (
            <span className="ml-1.5 text-gold">🔥 {member.streak}</span>
          )}
        </p>
      </button>

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-1.5">
        {/* Cheer */}
        <button
          type="button"
          onClick={() => onCheer(member.id, displayName)}
          className="flex items-center gap-1 rounded-full bg-emerald-500/12 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-500/20 active:scale-95"
        >
          🎉 <span className="hidden sm:inline">Cheer</span>
        </button>
        {/* Nudge */}
        <button
          type="button"
          onClick={() => !isNudged && onNudge(member.id, displayName)}
          disabled={isNudged || member.checkedInToday}
          className={cn(
            "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
            isNudged || member.checkedInToday
              ? "bg-cream-dark text-ink-muted cursor-default opacity-50"
              : "bg-amber-500/12 text-amber-700 hover:bg-amber-500/20"
          )}
        >
          🔔 <span className="hidden sm:inline">{isNudged ? "Sent" : "Nudge"}</span>
        </button>
      </div>
    </div>
  );
}

// ─── SharedGoalsSection ───────────────────────────────────────────────────────

function SharedGoalsSection({
  goals,
  members,
}: {
  goals: UserGoal[];
  members: CircleMember[];
}) {
  const publicGoals = goals.filter((g) => g.isPublic);
  if (publicGoals.length === 0 || members.length === 0) return null;

  return (
    <div className="border-t border-cream-dark pt-4 px-4 pb-3">
      <p className="section-label mb-3">Shared Goals</p>
      <div className="space-y-3">
        {publicGoals.slice(0, 3).map((goal) => (
          <div key={goal.id} className="flex items-center gap-3">
            <span className="flex-shrink-0 text-lg leading-none">{goal.emoji ?? "⭐"}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{goal.title}</p>
            </div>
            {/* Member completion chips */}
            <div className="flex flex-shrink-0 -space-x-1.5">
              {members.slice(0, 4).map((m) => (
                <div
                  key={m.id}
                  title={m.name ?? m.username ?? ""}
                  className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border-2 border-cream-paper text-[9px] font-bold text-white"
                  style={{ background: avatarColor(m.name) }}
                >
                  {m.image
                    ? <img src={m.image} alt="" className="h-full w-full object-cover" />
                    : initials(m.name)
                  }
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SuggestionCard ───────────────────────────────────────────────────────────

function SuggestionCard({
  person,
  onAdd,
  added,
}: {
  person: SuggestedPerson;
  onAdd: (id: string, name: string) => void;
  added: boolean;
}) {
  const color = avatarColor(person.name);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-cream-dark bg-cream-paper px-3.5 py-3 transition-all hover:shadow-sm">
      <div
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl text-sm font-bold text-white"
        style={{ background: color }}
      >
        {person.image
          ? <img src={person.image} alt={person.name ?? ""} className="h-full w-full object-cover" />
          : initials(person.name)
        }
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {person.name ?? `@${person.username}`}
        </p>
        <p className="text-xs text-ink-muted">
          {person.streak > 0 ? `🔥 ${person.streak} streak` : `${person.totalGoalsCompleted} goals`}
        </p>
      </div>
      {added ? (
        <span className="flex-shrink-0 rounded-full bg-emerald-500/12 px-3 py-1.5 text-xs font-semibold text-emerald-600">
          Sent ✓
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onAdd(person.id, person.name ?? person.username ?? "them")}
          className="flex flex-shrink-0 items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-cream-paper transition hover:opacity-80"
        >
          <UserPlus className="h-3 w-3" />
          Add
        </button>
      )}
    </div>
  );
}

// ─── InviteModal ──────────────────────────────────────────────────────────────

function InviteModal({
  open,
  onClose,
  onConnected,
  onViewProfile,
}: {
  open: boolean;
  onClose: () => void;
  onConnected: (name: string) => void;
  onViewProfile: (id: string) => void;
}) {
  if (!open) return null;
  return (
    <UserSearchModal
      open={open}
      onClose={onClose}
      onConnected={onConnected}
      onViewProfile={(id, _conn) => { onClose(); onViewProfile(id); }}
    />
  );
}

// ─── Main CircleFeed ──────────────────────────────────────────────────────────

export function CircleFeed({
  currentUserId,
  currentUserName,
  circleMembers,
  userGoals,
  pendingRequests,
  suggestedPeople,
  activeToday,
}: CircleFeedProps) {
  const router = useRouter();

  const [inviteOpen, setInviteOpen]         = useState(false);
  const [profileUserId, setProfileUserId]   = useState<string | null>(null);
  const [profileOpen, setProfileOpen]       = useState(false);
  const [celebOpen, setCelebOpen]           = useState(false);
  const [celebName, setCelebName]           = useState("");

  // Track nudged IDs in localStorage (rate-limit once per day client-side too)
  const [nudgedIds, setNudgedIds] = useState<Set<string>>(() => {
    try {
      const today = new Date().toISOString().split("T")[0]!;
      const raw = localStorage.getItem(`nudged_${today}`);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch { return new Set(); }
  });

  // Track sent invite IDs for suggestions
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const handleConnected = useCallback((name: string) => {
    setCelebName(name);
    setCelebOpen(true);
    router.refresh();
  }, [router]);

  const openProfile = useCallback((userId: string) => {
    setProfileUserId(userId);
    setProfileOpen(true);
  }, []);

  const handleCheer = async (targetId: string, name: string) => {
    try {
      await fetch("/api/circle/cheer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId }),
      });
      toast(`Cheer sent to ${name}! 🎉`);
    } catch {
      toast("Failed to send cheer", "error");
    }
  };

  const handleNudge = async (targetId: string, name: string) => {
    try {
      const res = await fetch("/api/circle/nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId }),
      });
      const data = (await res.json()) as { alreadyNudged?: boolean };
      if (data.alreadyNudged) {
        toast(`Already nudged ${name} today`);
        return;
      }
      toast(`Nudge sent to ${name}! 🔔`);
      setNudgedIds((prev) => {
        const next = new Set(prev).add(targetId);
        try {
          const today = new Date().toISOString().split("T")[0]!;
          localStorage.setItem(`nudged_${today}`, JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });
    } catch {
      toast("Failed to send nudge", "error");
    }
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
    } catch {
      toast("Failed to send invite", "error");
    }
  };

  const incomingCount = pendingRequests.filter((r) => r.direction === "incoming").length;
  const totalMembers = circleMembers.length;

  return (
    <>
      {/* ── Modals ────────────────────────────────────────── */}
      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onConnected={handleConnected}
        onViewProfile={openProfile}
      />

      <UserProfileModal
        userId={profileUserId}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onMessage={() => {}}
        onConnected={handleConnected}
      />

      <FriendCelebration
        isOpen={celebOpen}
        onClose={() => setCelebOpen(false)}
        friendName={celebName}
      />

      {/* ── Page header ───────────────────────────────────── */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="section-label">Stay Accountable</p>
          <h1 className="mt-2 font-serif text-3xl text-ink sm:text-4xl">My Circle</h1>
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
          Invite
        </button>
      </div>

      {/* ── Pending requests ──────────────────────────────── */}
      {(pendingRequests.length > 0) && (
        <div className="mb-5">
          <PendingRequestsPanel requests={pendingRequests} onAccepted={handleConnected} />
        </div>
      )}

      {/* ── Circle members panel ──────────────────────────── */}
      <div className="panel-shell overflow-hidden mb-5">
        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-cream-dark px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-ink-muted" />
            <p className="text-sm font-semibold text-ink">My Accountability Circle</p>
            <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-cream-paper">
              {totalMembers}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="text-xs font-medium text-gold hover:text-gold/80 transition-colors"
          >
            + Add member
          </button>
        </div>

        {/* Member list */}
        {circleMembers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gold/10">
              <Users className="h-7 w-7 text-gold" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Your circle is empty</p>
              <p className="mt-1 text-xs text-ink-muted">Invite friends to hold each other accountable.</p>
            </div>
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="mt-1 flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-bold text-ink transition hover:opacity-90"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Invite your first friend
            </button>
          </div>
        ) : (
          <div className="divide-y divide-cream-dark/60">
            {circleMembers.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                onViewProfile={openProfile}
                onCheer={handleCheer}
                onNudge={handleNudge}
                nudgedIds={nudgedIds}
              />
            ))}
          </div>
        )}

        {/* Shared goals section */}
        <SharedGoalsSection goals={userGoals} members={circleMembers} />
      </div>

      {/* ── People you may know ───────────────────────────── */}
      {suggestedPeople.length > 0 && (
        <div className="mb-5">
          <p className="section-label mb-3">People You May Know</p>
          <div className="space-y-2">
            {suggestedPeople.map((person) => (
              <SuggestionCard
                key={person.id}
                person={person}
                onAdd={handleAddSuggestion}
                added={addedIds.has(person.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── How it works (empty state tip) ───────────────── */}
      {circleMembers.length === 0 && suggestedPeople.length === 0 && (
        <div className="panel-shell p-6 text-center">
          <p className="text-3xl mb-3">🌟</p>
          <p className="text-sm font-semibold text-ink mb-1">How Circle works</p>
          <div className="mt-4 space-y-3 text-left max-w-xs mx-auto">
            {[
              { step: "1", text: "Invite friends via username or share link" },
              { step: "2", text: "They accept and join your accountability circle" },
              { step: "3", text: "See each other's goal progress and check-ins" },
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
