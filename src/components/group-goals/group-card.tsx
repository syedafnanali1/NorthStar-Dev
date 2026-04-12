"use client";

// src/components/group-goals/group-card.tsx
// Community Group card — same visual structure as GroupGoalCard.

import Link from "next/link";
import { Crown, Users, Globe, Lock } from "lucide-react";
import { cn } from "@/lib/utils/index";
import type { GroupWithMeta } from "@/server/services/groups.service";

interface GroupCardProps {
  group: GroupWithMeta;
  currentUserId: string;
}

// Map the group category enum to an accent color
const CATEGORY_COLORS: Record<string, string> = {
  health:     "#4caf82",
  fitness:    "#e07d3a",
  finance:    "#3a7fe0",
  mindset:    "#8b5cf6",
  writing:    "#d97706",
  reading:    "#92644a",
  career:     "#0891b2",
  lifestyle:  "#db2777",
  creativity: "#7c3aed",
  community:  "#059669",
  other:      "#C4963A",
};

function accentFor(category: string | null | undefined): string {
  return category ? (CATEGORY_COLORS[category] ?? "#C4963A") : "#C4963A";
}

function MemberAvatarStack({
  members,
}: {
  members: GroupWithMeta["members"];
}) {
  const visible = members.slice(0, 4);
  const overflow = members.length - 4;
  return (
    <div className="flex items-center">
      {visible.map((m, i) => {
        const inits = m.name
          ? m.name.split(" ").map((p) => p[0]?.toUpperCase() ?? "").join("").slice(0, 2)
          : "?";
        return (
          <div
            key={m.id}
            className="relative inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border-2 border-cream-paper bg-gold text-[9px] font-bold text-ink"
            style={{ marginLeft: i === 0 ? 0 : -6, zIndex: visible.length - i }}
            title={m.name ?? "Member"}
          >
            {m.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.image} alt={m.name ?? ""} className="h-full w-full object-cover" />
            ) : (
              inits
            )}
          </div>
        );
      })}
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

export function GroupCard({ group, currentUserId: _currentUserId }: GroupCardProps) {
  const href = group.id.startsWith("grp_")
    ? `/groups/community/${group.id}`
    : `/groups/${group.id}`;

  const category = "category" in group && group.category ? (group.category as string) : null;
  const accent = accentFor(category);
  const owner = group.members.find((m) => m.role === "owner") ?? group.members[0];
  const isPublic = group.type === "public";

  return (
    <div className="group/card relative flex flex-col overflow-hidden rounded-2xl border border-cream-dark bg-cream-paper shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">

      {/* Gradient header — mirrors GroupGoalCard */}
      <div
        className="relative h-24 w-full overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${accent}22 0%, ${accent}44 100%)`,
          borderBottom: `1px solid ${accent}33`,
        }}
      >
        {/* Accent stripe */}
        <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: accent }} />

        {/* Emoji / cover image */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          {group.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={group.coverImage}
              alt=""
              className="h-14 w-14 rounded-2xl object-cover shadow-sm"
            />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl shadow-sm"
              style={{ background: `${accent}22`, border: `1.5px solid ${accent}44` }}
            >
              ⭐
            </div>
          )}
        </div>

        {/* Top-right badge: visibility */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full bg-cream-paper/90 px-2 py-0.5 text-[10px] font-medium text-ink-muted backdrop-blur-sm"
            )}
          >
            {isPublic ? <Globe className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
            {isPublic ? "Public" : "Private"}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        {/* Category */}
        {category && (
          <p className="section-label mb-1">{category}</p>
        )}

        {/* Name */}
        <Link
          href={href}
          className="block font-serif text-[1.0625rem] font-semibold leading-snug text-ink transition-colors hover:text-gold"
        >
          {group.name}
        </Link>

        {/* Description */}
        {group.description && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">
            {group.description}
          </p>
        )}

        {/* Creator */}
        {owner && (
          <div className="mt-2.5 flex items-center gap-1.5">
            <Crown className="h-3 w-3 text-gold" />
            <span className="text-xs text-ink-muted">
              by{" "}
              {owner.username ? (
                <Link
                  href={`/profile/${owner.username}`}
                  className="font-medium text-ink hover:text-gold hover:underline"
                >
                  {owner.name ?? `@${owner.username}`}
                </Link>
              ) : (
                <span className="font-medium text-ink">{owner.name ?? "Creator"}</span>
              )}
            </span>
          </div>
        )}

        <div className="flex-1" />

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-cream-dark pt-3">
          <div className="flex items-center gap-3">
            {group.members.length > 0 && (
              <MemberAvatarStack members={group.members} />
            )}
            <span className="flex items-center gap-1 text-xs text-ink-muted">
              <Users className="h-3 w-3" />
              {group.memberCount}
            </span>
          </div>

          <Link
            href={href}
            className="inline-flex items-center gap-1 rounded-full bg-cream-dark px-3 py-1.5 text-xs font-semibold text-ink transition-all hover:bg-ink hover:text-cream-paper"
          >
            Open <span>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
