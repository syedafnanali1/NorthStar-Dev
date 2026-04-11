"use client";

// src/components/group-goals/group-card.tsx
// Card for the new community Group model (groups table).
// Used on the /groups page under "My Groups" and "Discover Groups".

import Link from "next/link";
import { Globe, Lock, Users, Crown, TrendingUp, Zap } from "lucide-react";
import { cn } from "@/lib/utils/index";
import type { GroupWithMeta } from "@/server/services/groups.service";

interface GroupCardProps {
  group: GroupWithMeta;
  currentUserId: string;
}

function Avatar({ name, image }: { name: string | null; image: string | null }) {
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
        className="h-7 w-7 rounded-full object-cover ring-2 ring-cream-paper"
      />
    );
  }
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/25 text-[0.6rem] font-bold text-gold ring-2 ring-cream-paper">
      {inits}
    </div>
  );
}

function PopularityTierBadge({ score }: { score: number }) {
  if (score >= 70) {
    return (
      <span className="flex items-center gap-0.5 rounded-full bg-gold/15 px-2 py-0.5 text-[0.6rem] font-bold text-gold">
        ✦ Elite
      </span>
    );
  }
  if (score >= 35) {
    return (
      <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[0.6rem] font-bold text-emerald-600">
        <Zap className="h-2 w-2" />
        Active
      </span>
    );
  }
  if (score > 0) {
    return (
      <span className="flex items-center gap-0.5 rounded-full bg-sky-50 px-2 py-0.5 text-[0.6rem] font-bold text-sky-600">
        <TrendingUp className="h-2 w-2" />
        Rising
      </span>
    );
  }
  return null;
}

export function GroupCard({ group, currentUserId }: GroupCardProps) {
  const isOwner = group.myRole === "owner";
  const isPublic = group.type === "public";
  // New-model groups use /groups/community/[id]; legacy use /groups/[id]
  const href = group.id.startsWith("grp_")
    ? `/groups/community/${group.id}`
    : `/groups/${group.id}`;

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-cream-dark bg-cream-paper shadow-[0_2px_8px_rgba(26,23,20,0.06)] transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5"
    >
      {/* Top accent strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-gold/60 to-gold/20" />

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Name + badges */}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-serif text-base font-semibold text-ink leading-snug">
              {group.name}
            </h3>
            {group.description && (
              <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted leading-relaxed">
                {group.description}
              </p>
            )}
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-1 pt-0.5">
            <div className="flex items-center gap-1.5">
              {isOwner && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold/20 text-gold">
                  <Crown className="h-3 w-3" />
                </span>
              )}
              <span
                className={cn(
                  "flex h-5 items-center gap-1 rounded-full px-2 text-[0.65rem] font-medium",
                  isPublic
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-cream-dark text-ink-muted"
                )}
              >
                {isPublic ? (
                  <Globe className="h-2.5 w-2.5" />
                ) : (
                  <Lock className="h-2.5 w-2.5" />
                )}
                {isPublic ? "Public" : "Private"}
              </span>
            </div>
            {isPublic && <PopularityTierBadge score={group.popularityScore ?? 0} />}
          </div>
        </div>

        {/* Category pill */}
        {"category" in group && group.category && (
          <div>
            <span className="rounded-full bg-cream-dark px-2.5 py-0.5 text-[0.65rem] font-medium capitalize text-ink-muted">
              {group.category as string}
            </span>
          </div>
        )}

        {/* Member count + avatar stack */}
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {group.members.slice(0, 4).map((m) => (
              <Avatar key={m.id} name={m.name} image={m.image} />
            ))}
          </div>
          <span className="flex items-center gap-1 text-xs text-ink-muted">
            <Users className="h-3 w-3" />
            {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-cream-dark px-4 py-2.5">
        <span className="text-sm font-semibold text-gold transition-colors group-hover:text-gold/80">
          →
        </span>
      </div>
    </Link>
  );
}
