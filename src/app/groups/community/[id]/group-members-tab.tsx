"use client";

// src/app/groups/community/[id]/group-members-tab.tsx
// Members roster: Top Contributors section + full member list with 4-tier badges.

import { useState, useEffect } from "react";
import { Crown, Trophy, Flame, UserPlus, Check, Clock, Star } from "lucide-react";
import type { GroupMemberWithMeta } from "@/server/services/group-chat.service";

// ─── Engagement badge config ───────────────────────────────────────────────────

const BADGE_CONFIG: Record<
  GroupMemberWithMeta["engagementBadge"],
  { label: string; className: string; icon?: React.ReactNode }
> = {
  Champion:  { label: "Champion",  className: "bg-gold/20 text-gold ring-1 ring-gold/40",          icon: <Crown  className="h-3 w-3" /> },
  Committed: { label: "Committed", className: "bg-purple-100 text-purple-700 ring-1 ring-purple-300", icon: <Star  className="h-3 w-3" /> },
  Active:    { label: "Active",    className: "bg-sage/15 text-sage-dark",                           icon: <Flame  className="h-3 w-3" /> },
  Newcomer:  { label: "Newcomer",  className: "bg-cream-dark text-ink-muted",                        icon: undefined },
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({
  name,
  image,
  size = "md",
}: {
  name: string | null;
  image: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const initials = (name ?? "?").slice(0, 2).toUpperCase();
  const dim =
    size === "lg" ? "h-12 w-12 text-sm"
    : size === "md" ? "h-11 w-11 text-sm"
    : "h-8 w-8 text-xs";
  if (image) {
    return (
      <img src={image} alt={name ?? ""} className={`${dim} rounded-full object-cover flex-shrink-0`} />
    );
  }
  return (
    <div className={`${dim} rounded-full bg-gold/20 text-gold font-semibold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ─── Engagement Badge ──────────────────────────────────────────────────────────

function EngagementBadge({ badge }: { badge: GroupMemberWithMeta["engagementBadge"] }) {
  const cfg = BADGE_CONFIG[badge];
  if (badge === "Newcomer") return null; // Don't render a badge for newcomers — it's the default
  return (
    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Role Badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: GroupMemberWithMeta["role"] }) {
  if (role === "owner") {
    return (
      <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs text-ink-muted font-medium">Owner</span>
    );
  }
  if (role === "admin") {
    return (
      <span className="rounded-full bg-sky/15 px-2 py-0.5 text-xs text-sky font-medium">Admin</span>
    );
  }
  return null;
}

// ─── Connect Button ────────────────────────────────────────────────────────────

function ConnectButton({
  memberId,
  initialStatus,
}: {
  memberId: string;
  initialStatus: GroupMemberWithMeta["connectionStatus"];
}) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    if (loading || status !== "none") return;
    setLoading(true);
    try {
      const res = await fetch("/api/circle/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: memberId }),
      });
      if (res.ok) setStatus("pending_sent");
    } finally {
      setLoading(false);
    }
  }

  if (status === "self") return null;
  if (status === "connected") {
    return (
      <span className="flex items-center gap-1 text-xs text-ink-muted">
        <Check className="h-3.5 w-3.5 text-sage" />
        In circle
      </span>
    );
  }
  if (status === "pending_sent") {
    return (
      <span className="flex items-center gap-1 text-xs text-ink-muted">
        <Clock className="h-3.5 w-3.5" />
        Sent
      </span>
    );
  }
  if (status === "pending_received") {
    return <span className="text-xs text-ink-muted italic">Wants to connect</span>;
  }
  return (
    <button
      type="button"
      onClick={() => void handleConnect()}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-full border border-ink/20 px-3 py-1 text-xs font-medium text-ink hover:bg-cream-dark transition-colors disabled:opacity-50"
    >
      <UserPlus className="h-3.5 w-3.5" />
      Add to Circle
    </button>
  );
}

// ─── Top Contributors Card ─────────────────────────────────────────────────────

const RANK_ICONS = [
  <Crown key="1" className="h-4 w-4 text-gold" />,
  <Trophy key="2" className="h-4 w-4 text-slate-400" />,
  <Flame key="3" className="h-4 w-4 text-orange-400" />,
];

function TopContributors({ members }: { members: GroupMemberWithMeta[] }) {
  const top3 = members.slice(0, 3).filter((m) => m.engagementScore > 0);
  if (top3.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gold/20 bg-gold/5 p-4 mb-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-gold mb-3">
        Top Contributors
      </p>
      <div className="space-y-2.5">
        {top3.map((m, i) => {
          const profileHref = m.username ? `/profile/${m.username}` : "#";
          return (
            <div key={m.userId} className="flex items-center gap-3">
              <div className="flex-shrink-0 flex items-center justify-center w-6">
                {RANK_ICONS[i]}
              </div>
              <Avatar name={m.name} image={m.image} size="sm" />
              <div className="flex-1 min-w-0">
                <a href={profileHref} className="text-sm font-semibold text-ink hover:underline truncate block">
                  {m.name ?? m.username ?? "Member"}
                </a>
                <p className="text-xs text-ink-muted">{m.engagementScore} pts · {m.engagementBadge}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Member Row ────────────────────────────────────────────────────────────────

function MemberRow({ member }: { member: GroupMemberWithMeta }) {
  const profileHref = member.username ? `/profile/${member.username}` : "#";
  const joinDate = new Date(member.joinedAt).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <div className="flex items-center gap-3 py-3 border-b border-cream-dark/50 last:border-0">
      <a href={profileHref}>
        <Avatar name={member.name} image={member.image} />
      </a>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <a href={profileHref} className="font-semibold text-sm text-ink hover:underline">
            {member.name ?? member.username ?? "Member"}
          </a>
          <RoleBadge role={member.role} />
          <EngagementBadge badge={member.engagementBadge} />
        </div>
        <p className="text-xs text-ink-muted mt-0.5">Joined {joinDate}</p>
      </div>
      <ConnectButton memberId={member.userId} initialStatus={member.connectionStatus} />
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

interface GroupMembersTabProps {
  groupId: string;
}

export function GroupMembersTab({ groupId }: GroupMembersTabProps) {
  const [members, setMembers] = useState<GroupMemberWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/groups/${groupId}/members`)
      .then((r) => r.json())
      .then((d: { members?: GroupMemberWithMeta[] }) => {
        if (!cancelled) setMembers(d.members ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  if (members.length === 0) {
    return <div className="py-12 text-center text-sm text-ink-muted">No members found.</div>;
  }

  return (
    <div>
      {/* Top Contributors spotlight */}
      <TopContributors members={members} />

      <p className="text-xs text-ink-muted mb-3">
        {members.length} member{members.length !== 1 ? "s" : ""}
      </p>
      <div>
        {members.map((m) => (
          <MemberRow key={m.userId} member={m} />
        ))}
      </div>
    </div>
  );
}
