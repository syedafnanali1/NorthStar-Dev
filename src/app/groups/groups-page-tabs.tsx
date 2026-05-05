"use client";

// src/app/groups/groups-page-tabs.tsx

import { useState, useTransition, useCallback, useRef } from "react";
import Link from "next/link";
import { Search, Users, Globe, Lock, Crown, TrendingUp, Zap, LogIn, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/index";
import { toast } from "@/components/ui/toaster";
import { GroupCard, CATEGORY_COLORS, CATEGORY_EMOJI } from "@/components/group-goals/group-card";
import { GroupGoalCard } from "@/components/group-goals/group-goal-card";
import { GroupsPageClient } from "./groups-page-client";
import type { GroupWithMeta, InvitableFriend } from "@/server/services/groups.service";
import type { GroupGoalWithMembers } from "@/server/services/group-goals.service";
import type { DiscoverSortBy } from "@/server/services/groups.service";

interface GroupsPageTabsProps {
  myGroups: GroupWithMeta[];
  myOldGroups: GroupGoalWithMembers[];
  initialAllGroups: GroupWithMeta[];
  invitableFriends: InvitableFriend[];
  currentUserId: string;
}

const CATEGORIES = [
  { value: "health",     label: "Health",      emoji: "🌿" },
  { value: "fitness",    label: "Fitness",     emoji: "💪" },
  { value: "finance",    label: "Finance",     emoji: "💰" },
  { value: "mindset",    label: "Mindset",     emoji: "🧠" },
  { value: "writing",    label: "Writing",     emoji: "✍️" },
  { value: "reading",    label: "Reading",     emoji: "📚" },
  { value: "career",     label: "Career",      emoji: "🚀" },
  { value: "lifestyle",  label: "Lifestyle",   emoji: "🌟" },
  { value: "creativity", label: "Creativity",  emoji: "🎨" },
  { value: "community",  label: "Community",   emoji: "🤝" },
  { value: "other",      label: "Other",       emoji: "✨" },
] as const;

// ─── Tier helpers ─────────────────────────────────────────────────────────────

type Tier = "Rising" | "Active" | "Elite";

function tierForScore(score: number): Tier {
  if (score >= 70) return "Elite";
  if (score >= 35) return "Active";
  return "Rising";
}

const TIER_CONFIG: Record<Tier, { icon: React.ReactNode; className: string }> = {
  Rising: { icon: <TrendingUp className="h-3 w-3" />, className: "bg-sky-50 text-sky-600" },
  Active: { icon: <Zap className="h-3 w-3" />,        className: "bg-emerald-50 text-emerald-600" },
  Elite:  { icon: <Crown className="h-3 w-3" />,      className: "bg-gold/10 text-gold" },
};

function TierBadge({ tier }: { tier: Tier }) {
  const { icon, className } = TIER_CONFIG[tier];
  return (
    <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", className)}>
      {icon}{tier}
    </span>
  );
}

// ─── Welcome Sheet ────────────────────────────────────────────────────────────

function WelcomeSheet({ groupName, groupId, onClose }: { groupName: string; groupId: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[rgba(26,23,20,0.55)] backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm rounded-t-3xl bg-cream-paper p-7 text-center sm:rounded-3xl">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="font-serif text-xl font-bold text-ink">Welcome to {groupName}!</h2>
        <p className="mt-2 text-sm text-ink-muted">You&apos;re now a member. See the group goals, check-ins, and activity feed.</p>
        <div className="mt-6 flex flex-col gap-2.5">
          <Link href={`/groups/community/${groupId}`} onClick={onClose}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gold px-5 py-3 text-sm font-bold text-ink transition hover:opacity-90">
            Open Group <ChevronRight className="h-4 w-4" />
          </Link>
          <button type="button" onClick={onClose} className="text-sm text-ink-muted hover:text-ink transition">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Discover Card ────────────────────────────────────────────────────────────

function DiscoverGroupCard({
  group, onJoin, joiningId, joinedIds,
}: {
  group: GroupWithMeta;
  onJoin: (id: string, name: string, isPublic: boolean) => void;
  joiningId: string | null;
  joinedIds: Set<string>;
}) {
  const category = "category" in group && group.category ? (group.category as string) : null;
  const accent = category ? (CATEGORY_COLORS[category] ?? "#C4963A") : "#C4963A";
  const score = (group as GroupWithMeta & { popularityScore?: number }).popularityScore ?? 0;
  const tier = tierForScore(score);
  const isPublic = group.type === "public";
  const owner = group.members.find((m) => m.role === "owner") ?? group.members[0];
  const isJoining = joiningId === group.id;
  const wasJoined = joinedIds.has(group.id);

  return (
    <div className="group/card relative flex flex-col overflow-hidden rounded-2xl border border-cream-dark bg-cream-paper shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
      {/* Accent top bar */}
      <div className="h-0.5 w-full" style={{ background: accent }} />

      {/* Gradient header */}
      <div className="relative h-20 overflow-hidden" style={{ background: `linear-gradient(135deg, ${accent}14 0%, ${accent}30 100%)` }}>
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          {(group as GroupWithMeta & { coverImage?: string }).coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={(group as GroupWithMeta & { coverImage?: string }).coverImage!} alt="" className="h-12 w-12 rounded-xl object-cover shadow-sm" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl shadow-sm"
              style={{ background: `${accent}20`, border: `1.5px solid ${accent}40` }}>
              {category ? CATEGORY_EMOJI[category] ?? "⭐" : "⭐"}
            </div>
          )}
        </div>
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          <TierBadge tier={tier} />
          <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm",
            isPublic ? "bg-cream-paper/80 text-emerald-700" : "bg-cream-paper/80 text-ink-muted")}>
            {isPublic ? <Globe className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
            {isPublic ? "Public" : "Private"}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        {category && <p className="section-label mb-1">{CATEGORY_EMOJI[category] ?? ""} {category}</p>}
        <p className="font-serif text-[1.0625rem] font-semibold leading-snug text-ink line-clamp-1">{group.name}</p>
        {group.description && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">{group.description}</p>
        )}
        {owner && (
          <div className="mt-2 flex items-center gap-1.5">
            <Crown className="h-3 w-3 text-gold" />
            <span className="text-xs text-ink-muted">by <span className="font-medium text-ink">{owner.name ?? owner.username ?? "Creator"}</span></span>
          </div>
        )}

        {/* Popularity bar */}
        <div className="mt-3 space-y-1">
          <div className="h-1 overflow-hidden rounded-full bg-cream-dark">
            <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: accent }} />
          </div>
        </div>

        <div className="flex-1" />

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-cream-dark pt-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              {group.members.slice(0, 4).map((m, i) => {
                const inits = m.name ? m.name.split(" ").map((p: string) => p[0]?.toUpperCase() ?? "").join("").slice(0, 2) : "?";
                return (
                  <div key={m.id} className="relative inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border-2 border-cream-paper bg-gold text-[9px] font-bold text-ink"
                    style={{ marginLeft: i === 0 ? 0 : -6, zIndex: 4 - i }}>
                    {m.image
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={m.image} alt={m.name ?? ""} className="h-full w-full object-cover" />
                      : inits}
                  </div>
                );
              })}
            </div>
            <span className="flex items-center gap-1 text-xs text-ink-muted">
              <Users className="h-3 w-3" /> {group.memberCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Link href={`/groups/community/${group.id}`}
              className="text-xs font-medium text-ink-muted hover:text-ink transition-colors">
              View →
            </Link>
            {wasJoined ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600">
                ✓ {isPublic ? "Joined" : "Requested"}
              </span>
            ) : (
              <button type="button" onClick={() => onJoin(group.id, group.name, isPublic)} disabled={isJoining}
                className="flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-cream-paper transition hover:opacity-90 active:scale-95 disabled:opacity-50">
                <LogIn className="h-3 w-3" />
                {isJoining ? "…" : isPublic ? "Join" : "Request"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function GroupsPageTabs({
  myGroups, myOldGroups, initialAllGroups, invitableFriends, currentUserId,
}: GroupsPageTabsProps) {
  const [tab, setTab] = useState<"mine" | "all">(myGroups.length > 0 || myOldGroups.length > 0 ? "mine" : "all");
  const [allGroups, setAllGroups] = useState<GroupWithMeta[]>(initialAllGroups);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<DiscoverSortBy>("popularity");
  const [isPending, startTransition] = useTransition();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [welcomeGroup, setWelcomeGroup] = useState<{ id: string; name: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const hasAnyGroup = myGroups.length > 0 || myOldGroups.length > 0;
  const totalMyCount = myGroups.length + myOldGroups.length;

  const fetchAll = useCallback((q: string, cat: string, s: DiscoverSortBy) => {
    startTransition(async () => {
      try {
        const params = new URLSearchParams({ q, sort: s });
        if (cat) params.set("category", cat);
        const res = await fetch(`/api/groups/discover?${params.toString()}`);
        if (!res.ok) throw new Error("fetch failed");
        const data = (await res.json()) as { groups: GroupWithMeta[] };
        setAllGroups(data.groups);
      } catch { toast("Failed to load groups", "error"); }
    });
  }, []);

  function handleQuery(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchAll(val, category, sort), 300);
  }

  function handleCategory(val: string) {
    const next = val === category ? "" : val;
    setCategory(next);
    fetchAll(query, next, sort);
  }

  function handleSort(s: DiscoverSortBy) {
    setSort(s);
    fetchAll(query, category, s);
  }

  async function handleJoin(groupId: string, groupName: string, isPublic: boolean) {
    setJoiningId(groupId);
    try {
      const res = await fetch(`/api/groups/${groupId}/join`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed");
      }
      setJoinedIds((prev) => new Set(prev).add(groupId));
      if (isPublic) {
        setWelcomeGroup({ id: groupId, name: groupName });
        setAllGroups((prev) => prev.filter((g) => g.id !== groupId));
      } else {
        toast(`Request sent to join ${groupName}`);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to join group", "error");
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <>
      {welcomeGroup && (
        <WelcomeSheet groupName={welcomeGroup.name} groupId={welcomeGroup.id} onClose={() => setWelcomeGroup(null)} />
      )}

      <div className="space-y-6">
        {/* ── Tab bar ── */}
        <div className="flex items-center gap-1 rounded-xl bg-cream-dark/50 p-1 w-fit">
          {[
            { id: "mine" as const, label: "My Groups", icon: <Users className="h-3.5 w-3.5" />, count: totalMyCount },
            { id: "all" as const,  label: "Discover",  icon: <Globe className="h-3.5 w-3.5" /> },
          ].map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                tab === t.id ? "bg-cream-paper text-ink shadow-sm" : "text-ink-muted hover:text-ink"
              )}>
              {t.icon}
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={cn("rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold",
                  tab === t.id ? "bg-cream-dark text-ink-muted" : "bg-cream-dark/50 text-ink-muted")}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── My Groups ── */}
        {tab === "mine" && (
          <div className="space-y-6">
            {!hasAnyGroup ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-cream-dark bg-cream-paper/60 px-8 py-16 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-cream-dark text-3xl">🏆</div>
                <p className="font-serif text-xl font-semibold text-ink">No groups yet</p>
                <p className="mt-2 max-w-xs text-sm text-ink-muted">Create your first group or browse in Discover.</p>
                <div className="mt-6 flex gap-3">
                  <GroupsPageClient invitableFriends={invitableFriends} variant="inline" />
                  <button type="button" onClick={() => setTab("all")}
                    className="flex items-center gap-1.5 rounded-full border border-cream-dark px-4 py-2 text-sm font-semibold text-ink transition hover:bg-cream-dark">
                    <Globe className="h-3.5 w-3.5" /> Discover Groups
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {myGroups.length > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="section-label">
                        {myGroups.length} active group{myGroups.length !== 1 ? "s" : ""}
                      </p>
                      <button type="button" onClick={() => setTab("all")} className="text-xs font-medium text-gold hover:opacity-80 transition-opacity">
                        Discover more →
                      </button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {myGroups.map((group) => (
                        <GroupCard key={group.id} group={group} currentUserId={currentUserId} />
                      ))}
                    </div>
                  </>
                )}

                {myOldGroups.length > 0 && (
                  <div className="space-y-4">
                    {myGroups.length > 0 && (
                      <p className="section-label text-ink-muted">Collaborative Goals</p>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {myOldGroups.map((group) => (
                        <GroupGoalCard key={group.id} group={group} currentUserId={currentUserId} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Discover ── */}
        {tab === "all" && (
          <div className="space-y-5">
            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input type="search" value={query} onChange={handleQuery}
                placeholder="Search by name, category, or description…"
                className="form-input w-full py-2.5 pl-9 pr-4" />
            </div>

            {/* Sort pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-ink-muted font-medium">Sort:</span>
              {([["popularity", "🔥 Popular"], ["newest", "✨ Newest"], ["members", "👥 Members"]] as [DiscoverSortBy, string][]).map(([s, label]) => (
                <button key={s} type="button" onClick={() => handleSort(s)}
                  className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                    sort === s ? "border-gold bg-gold/10 text-ink" : "border-cream-dark text-ink-muted hover:border-gold/40 hover:text-ink")}>
                  {label}
                </button>
              ))}
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button key={cat.value} type="button" onClick={() => handleCategory(cat.value)}
                  className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                    category === cat.value ? "border-gold bg-gold/10 text-ink" : "border-cream-dark bg-cream-paper text-ink-muted hover:border-gold/40 hover:text-ink")}>
                  <span>{cat.emoji}</span>{cat.label}
                </button>
              ))}
            </div>

            {/* Tier legend */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-cream-dark bg-cream px-4 py-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">Tiers:</span>
              {(["Rising", "Active", "Elite"] as Tier[]).map((tier) => (
                <TierBadge key={tier} tier={tier} />
              ))}
            </div>

            {/* Results */}
            {isPending ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-56 animate-pulse rounded-2xl border border-cream-dark bg-cream-paper" />
                ))}
              </div>
            ) : allGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-cream-dark bg-cream-paper/60 px-8 py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-dark text-2xl">
                  <Search className="h-6 w-6 text-ink-muted" />
                </div>
                <p className="font-serif text-lg font-semibold text-ink">No groups found</p>
                <p className="mt-1 max-w-xs text-sm text-ink-muted">
                  {query || category ? "Try adjusting your search or clearing filters." : "No public groups available right now."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-ink-muted">{allGroups.length} group{allGroups.length !== 1 ? "s" : ""} found</p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {allGroups.map((group) => (
                    <DiscoverGroupCard
                      key={group.id}
                      group={group}
                      onJoin={(id, name, isPublic) => void handleJoin(id, name, isPublic)}
                      joiningId={joiningId}
                      joinedIds={joinedIds}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
