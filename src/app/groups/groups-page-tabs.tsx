"use client";

// src/app/groups/groups-page-tabs.tsx
// Tabbed "My Groups" | "All Groups" layout for the Groups page.
// "All" tab includes search bar + category filter chips, fetching from /api/groups/discover.

import { useState, useTransition, useCallback } from "react";
import {
  Search,
  Users,
  Star,
  Crown,
  LogIn,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils/index";
import { toast } from "@/components/ui/toaster";
import { GroupCard } from "@/components/group-goals/group-card";
import { GroupGoalCard } from "@/components/group-goals/group-goal-card";
import { GroupsPageClient } from "./groups-page-client";
import type { GroupWithMeta, InvitableFriend } from "@/server/services/groups.service";
import type { GroupGoalWithMembers } from "@/server/services/group-goals.service";
import type { DiscoverSortBy } from "@/server/services/groups.service";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface GroupsPageTabsProps {
  myGroups: GroupWithMeta[];
  myOldGroups: GroupGoalWithMembers[];
  initialAllGroups: GroupWithMeta[];
  invitableFriends: InvitableFriend[];
  currentUserId: string;
}

// ─── Category config ───────────────────────────────────────────────────────────

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

// ─── Category → accent color (mirrors group-card.tsx) ────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  health: "#4caf82", fitness: "#e07d3a", finance: "#3a7fe0",
  mindset: "#8b5cf6", writing: "#d97706", reading: "#92644a",
  career: "#0891b2", lifestyle: "#db2777", creativity: "#7c3aed",
  community: "#059669", other: "#C4963A",
};
function accentFor(cat: string | null | undefined) {
  return cat ? (CATEGORY_COLORS[cat] ?? "#C4963A") : "#C4963A";
}

// ─── Discover card (All tab) — same visual as GroupCard, "Request to Join" footer ─

function AllGroupCard({
  group,
  onRequestJoin,
  joiningId,
}: {
  group: GroupWithMeta;
  onRequestJoin: (id: string) => void;
  joiningId: string | null;
}) {
  const category = "category" in group && group.category ? (group.category as string) : null;
  const accent = accentFor(category);
  const owner = group.members.find((m) => m.role === "owner") ?? group.members[0];

  return (
    <div className="group/card relative flex flex-col overflow-hidden rounded-2xl border border-cream-dark bg-cream-paper shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
      {/* Gradient header */}
      <div
        className="relative h-24 w-full overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${accent}22 0%, ${accent}44 100%)`,
          borderBottom: `1px solid ${accent}33`,
        }}
      >
        <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: accent }} />
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          {group.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={group.coverImage} alt="" className="h-14 w-14 rounded-2xl object-cover shadow-sm" />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl shadow-sm"
              style={{ background: `${accent}22`, border: `1.5px solid ${accent}44` }}
            >
              ⭐
            </div>
          )}
        </div>
        <div className="absolute right-3 top-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-cream-paper/90 px-2 py-0.5 text-[10px] font-medium text-ink-muted backdrop-blur-sm">
            <Globe className="h-2.5 w-2.5" /> Public
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        {category && <p className="section-label mb-1">{category}</p>}
        <p className="font-serif text-[1.0625rem] font-semibold leading-snug text-ink line-clamp-1">
          {group.name}
        </p>
        {group.description && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">{group.description}</p>
        )}
        {owner && (
          <div className="mt-2.5 flex items-center gap-1.5">
            <Crown className="h-3 w-3 text-gold" />
            <span className="text-xs text-ink-muted">
              by <span className="font-medium text-ink">{owner.name ?? owner.username ?? "Creator"}</span>
            </span>
          </div>
        )}
        <div className="flex-1" />
        {/* Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-cream-dark pt-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              {group.members.slice(0, 4).map((m, i) => {
                const inits = m.name ? m.name.split(" ").map((p: string) => p[0]?.toUpperCase() ?? "").join("").slice(0, 2) : "?";
                return (
                  <div
                    key={m.id}
                    className="relative inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border-2 border-cream-paper bg-gold text-[9px] font-bold text-ink"
                    style={{ marginLeft: i === 0 ? 0 : -6, zIndex: 4 - i }}
                  >
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
          <button
            type="button"
            onClick={() => onRequestJoin(group.id)}
            disabled={joiningId === group.id}
            className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-cream-paper transition hover:opacity-90 disabled:opacity-50"
          >
            <LogIn className="h-3 w-3" />
            {joiningId === group.id ? "Sending…" : "Request to Join"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function GroupsPageTabs({
  myGroups,
  myOldGroups,
  initialAllGroups,
  invitableFriends,
  currentUserId,
}: GroupsPageTabsProps) {
  const [tab, setTab] = useState<"mine" | "all">("mine");

  // All tab state
  const [allGroups, setAllGroups] = useState<GroupWithMeta[]>(initialAllGroups);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort] = useState<DiscoverSortBy>("popularity");
  const [isPending, startTransition] = useTransition();
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const hasAnyGroup = myGroups.length > 0 || myOldGroups.length > 0;
  const totalMyCount = myGroups.length + myOldGroups.length;

  const fetchAll = useCallback(
    (q: string, cat: string, s: DiscoverSortBy) => {
      startTransition(async () => {
        try {
          const params = new URLSearchParams({ q, sort: s });
          if (cat) params.set("category", cat);
          const res = await fetch(`/api/groups/discover?${params.toString()}`);
          if (!res.ok) throw new Error("fetch failed");
          const data = (await res.json()) as { groups: GroupWithMeta[] };
          setAllGroups(data.groups);
        } catch {
          toast("Failed to load groups", "error");
        }
      });
    },
    []
  );

  function handleQuery(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    fetchAll(val, category, sort);
  }

  function handleCategory(val: string) {
    const next = val === category ? "" : val;
    setCategory(next);
    fetchAll(query, next, sort);
  }

  async function handleRequestJoin(groupId: string) {
    setJoiningId(groupId);
    try {
      const res = await fetch(`/api/groups/${groupId}/join`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to send request");
      }
      toast("Join request sent!", "success");
      setAllGroups((prev) => prev.filter((g) => g.id !== groupId));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to send request", "error");
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Tab bar ── */}
      <div className="flex items-center gap-1 rounded-xl bg-cream-dark/50 p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("mine")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all",
            tab === "mine"
              ? "bg-cream-paper text-ink shadow-sm"
              : "text-ink-muted hover:text-ink"
          )}
        >
          <Users className="h-3.5 w-3.5" />
          My Groups
          {totalMyCount > 0 && (
            <span className={cn(
              "rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold",
              tab === "mine" ? "bg-cream-dark text-ink-muted" : "bg-cream-dark/50 text-ink-muted"
            )}>
              {totalMyCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("all")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all",
            tab === "all"
              ? "bg-cream-paper text-ink shadow-sm"
              : "text-ink-muted hover:text-ink"
          )}
        >
          <Globe className="h-3.5 w-3.5" />
          All
        </button>
      </div>

      {/* ── My Groups tab ── */}
      {tab === "mine" && (
        <div className="space-y-6">
          {!hasAnyGroup ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-cream-dark bg-cream-paper/60 px-8 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-cream-dark text-3xl">
                🏆
              </div>
              <p className="font-serif text-xl font-semibold text-ink">No groups yet</p>
              <p className="mt-2 max-w-xs text-sm text-ink-muted">
                Create your first group or browse all public groups in the All tab.
              </p>
              <div className="mt-6">
                <GroupsPageClient invitableFriends={invitableFriends} variant="inline" />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {myGroups.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {myGroups.map((group) => (
                    <GroupCard key={group.id} group={group} currentUserId={currentUserId} />
                  ))}
                </div>
              )}

              {myOldGroups.length > 0 && (
                <>
                  {myGroups.length > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cream-dark">
                        <Star className="h-3 w-3 text-ink-muted" />
                      </div>
                      <p className="section-label text-ink-muted">Collaborative Goals</p>
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {myOldGroups.map((group) => (
                      <GroupGoalCard
                        key={group.id}
                        group={group}
                        currentUserId={currentUserId}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── All Groups tab ── */}
      {tab === "all" && (
        <div className="space-y-5">
          {/* Search bar */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="search"
              value={query}
              onChange={handleQuery}
              placeholder="Search groups by name, description, or category…"
              className="form-input w-full py-2.5 pl-9 pr-4"
            />
          </div>

          {/* Category filter chips */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => handleCategory(cat.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                  category === cat.value
                    ? "border-gold bg-gold/10 text-ink"
                    : "border-cream-dark bg-cream-paper text-ink-muted hover:border-gold/40 hover:text-ink"
                )}
              >
                <span>{cat.emoji}</span>
                {cat.label}
              </button>
            ))}
          </div>

          {/* Results */}
          {isPending ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-48 animate-pulse rounded-2xl border border-cream-dark bg-cream-paper"
                />
              ))}
            </div>
          ) : allGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-cream-dark bg-cream-paper/60 px-8 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-dark text-2xl">
                <Search className="h-6 w-6 text-ink-muted" />
              </div>
              <p className="font-serif text-lg font-semibold text-ink">No groups found</p>
              <p className="mt-1 max-w-xs text-sm text-ink-muted">
                {query || category
                  ? "Try adjusting your search or clearing filters."
                  : "No public groups available to discover right now."}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-ink-muted">
                {allGroups.length} group{allGroups.length !== 1 ? "s" : ""} found
              </p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {allGroups.map((group) => (
                  <AllGroupCard
                    key={group.id}
                    group={group}
                    onRequestJoin={(id) => void handleRequestJoin(id)}
                    joiningId={joiningId}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
