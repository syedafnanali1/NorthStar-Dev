"use client";

// src/app/groups/discover/discover-client.tsx
// Client-side search, sort, and group card grid for the Discovery page.

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  SlidersHorizontal,
  Globe,
  Users,
  TrendingUp,
  Star,
  Zap,
  Crown,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils/index";
import { toast } from "@/components/ui/toaster";
import type { GroupWithMeta } from "@/server/services/groups.service";
import type { DiscoverSortBy } from "@/server/services/groups.service";

// ── Popularity badge ──────────────────────────────────────────────────────────

function PopularityBadge({ score }: { score: number }) {
  if (score >= 70) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-0.5 text-[0.65rem] font-bold text-gold">
        <Crown className="h-2.5 w-2.5" />
        Elite
      </span>
    );
  }
  if (score >= 35) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-sage/20 px-2.5 py-0.5 text-[0.65rem] font-bold text-sage-600">
        <Zap className="h-2.5 w-2.5" />
        Active
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-sky/10 px-2.5 py-0.5 text-[0.65rem] font-bold text-sky-600">
      <TrendingUp className="h-2.5 w-2.5" />
      Rising
    </span>
  );
}

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(score, 100);
  const color =
    pct >= 70
      ? "bg-gradient-to-r from-gold/80 to-gold"
      : pct >= 35
        ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
        : "bg-gradient-to-r from-sky-400 to-sky-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream-dark">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-[0.65rem] font-semibold tabular-nums text-ink-muted">
        {pct}
      </span>
    </div>
  );
}

// ── Avatar stack ──────────────────────────────────────────────────────────────

function MemberAvatar({ name, image }: { name: string | null; image: string | null }) {
  const inits = name
    ? name
        .split(" ")
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("")
    : "?";
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name ?? ""}
        className="h-6 w-6 rounded-full object-cover ring-2 ring-cream-paper"
      />
    );
  }
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/25 text-[0.55rem] font-bold text-gold ring-2 ring-cream-paper">
      {inits}
    </div>
  );
}

// ── Discovery card ────────────────────────────────────────────────────────────

function DiscoveryCard({
  group,
  onRequestJoin,
  joiningId,
}: {
  group: GroupWithMeta;
  onRequestJoin: (id: string) => void;
  joiningId: string | null;
}) {
  const score = group.popularityScore ?? 0;

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-cream-dark bg-cream-paper shadow-[0_2px_8px_rgba(26,23,20,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
      {/* Top accent */}
      <div
        className={cn(
          "h-1.5 w-full",
          score >= 70
            ? "bg-gradient-to-r from-gold to-gold/50"
            : score >= 35
              ? "bg-gradient-to-r from-emerald-400 to-emerald-300"
              : "bg-gradient-to-r from-sky-400 to-sky-300"
        )}
      />

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Name + badges */}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-serif text-base font-semibold leading-snug text-ink">
              {group.name}
            </h3>
            {group.description && (
              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">
                {group.description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
            <PopularityBadge score={score} />
            <span className="flex items-center gap-1 text-[0.6rem] text-ink-muted">
              <Globe className="h-2.5 w-2.5" />
              Public
            </span>
          </div>
        </div>

        {/* Popularity score bar */}
        <div>
          <p className="mb-1 text-[0.6rem] font-medium uppercase tracking-widest text-ink-muted">
            Popularity
          </p>
          <ScoreBar score={score} />
        </div>

        {/* Members row */}
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1">
            {group.members.slice(0, 5).map((m) => (
              <MemberAvatar key={m.id} name={m.name} image={m.image} />
            ))}
          </div>
          <span className="flex items-center gap-1 text-xs text-ink-muted">
            <Users className="h-3 w-3" />
            {group.memberCount.toLocaleString()}{" "}
            {group.memberCount === 1 ? "member" : "members"}
          </span>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between border-t border-cream-dark px-4 py-2.5">
        <Link
          href={`/groups/${group.id}`}
          className="text-xs font-medium text-ink-muted transition-colors hover:text-ink"
        >
          View profile →
        </Link>
        <button
          type="button"
          onClick={() => onRequestJoin(group.id)}
          disabled={joiningId === group.id}
          className="flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-cream-paper transition hover:opacity-90 disabled:opacity-50"
        >
          <LogIn className="h-3 w-3" />
          {joiningId === group.id ? "Sending…" : "Request to Join"}
        </button>
      </div>
    </div>
  );
}

// ── Sort pill ─────────────────────────────────────────────────────────────────

function SortPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
        active
          ? "bg-ink text-cream-paper"
          : "bg-cream-dark text-ink-muted hover:bg-ink/10 hover:text-ink"
      )}
    >
      {label}
    </button>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

interface DiscoverClientProps {
  initialGroups: GroupWithMeta[];
}

export function DiscoverClient({ initialGroups }: DiscoverClientProps) {
  const [groups, setGroups] = useState<GroupWithMeta[]>(initialGroups);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<DiscoverSortBy>("popularity");
  const [isPending, startTransition] = useTransition();
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const fetchGroups = useCallback(
    (q: string, s: DiscoverSortBy) => {
      startTransition(async () => {
        try {
          const params = new URLSearchParams({ q, sort: s });
          const res = await fetch(`/api/groups/discover?${params.toString()}`);
          if (!res.ok) throw new Error("Failed to fetch");
          const data = (await res.json()) as { groups: GroupWithMeta[] };
          setGroups(data.groups);
        } catch {
          toast("Failed to load groups", "error");
        }
      });
    },
    []
  );

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    fetchGroups(val, sort);
  }

  function handleSort(s: DiscoverSortBy) {
    setSort(s);
    fetchGroups(query, s);
  }

  async function handleRequestJoin(groupId: string) {
    setJoiningId(groupId);
    try {
      const res = await fetch(`/api/groups/${groupId}/join`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to send request");
      }
      toast("Join request sent! The group admin will review it.", "success");
      // Remove from discover list optimistically
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to send request", "error");
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Search + Sort bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search groups by name or description…"
            className="form-input w-full py-2.5 pl-9 pr-4"
          />
        </div>

        {/* Sort pills */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
          <div className="flex items-center gap-1.5">
            <SortPill
              label="Popularity"
              active={sort === "popularity"}
              onClick={() => handleSort("popularity")}
            />
            <SortPill
              label="Newest"
              active={sort === "newest"}
              onClick={() => handleSort("newest")}
            />
            <SortPill
              label="Members"
              active={sort === "members"}
              onClick={() => handleSort("members")}
            />
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-cream-dark bg-cream-paper/60 px-4 py-3">
        <p className="text-xs font-medium text-ink-muted">Popularity tiers:</p>
        <span className="flex items-center gap-1.5 text-xs text-ink-muted">
          <TrendingUp className="h-3.5 w-3.5 text-sky-500" />
          <strong className="text-ink">Rising</strong> — score 0–34
        </span>
        <span className="flex items-center gap-1.5 text-xs text-ink-muted">
          <Zap className="h-3.5 w-3.5 text-emerald-500" />
          <strong className="text-ink">Active</strong> — score 35–69
        </span>
        <span className="flex items-center gap-1.5 text-xs text-ink-muted">
          <Crown className="h-3.5 w-3.5 text-gold" />
          <strong className="text-ink">Elite</strong> — score 70–100
        </span>
      </div>

      {/* Grid */}
      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-2xl border border-cream-dark bg-cream-paper"
            />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-cream-dark bg-cream-paper/60 px-8 py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-dark text-2xl">
            <Search className="h-6 w-6 text-ink-muted" />
          </div>
          <p className="font-serif text-lg font-semibold text-ink">No groups found</p>
          <p className="mt-1 max-w-xs text-sm text-ink-muted">
            {query
              ? `No public groups match "${query}". Try a different search.`
              : "No public groups available to discover right now."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-ink-muted">
            {groups.length} group{groups.length !== 1 ? "s" : ""} found
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <DiscoveryCard
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
  );
}
