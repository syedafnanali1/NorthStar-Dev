"use client";

// src/components/group-goals/group-card.tsx
// Card for the new community Group model (groups table).
// Matches the GroupGoalCard visual style: cover area, category, name, description, creator, footer.

import Link from "next/link";
import { Crown, Users } from "lucide-react";
import type { GroupWithMeta } from "@/server/services/groups.service";

interface GroupCardProps {
  group: GroupWithMeta;
  currentUserId: string;
}

function MemberAvatar({ name, image }: { name: string | null; image: string | null }) {
  const inits = name
    ? name.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")
    : "?";
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt={name ?? ""} className="h-7 w-7 rounded-full object-cover ring-2 ring-cream-paper" />
    );
  }
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/25 text-[0.6rem] font-bold text-gold ring-2 ring-cream-paper">
      {inits}
    </div>
  );
}

export function GroupCard({ group, currentUserId: _currentUserId }: GroupCardProps) {
  const href = group.id.startsWith("grp_")
    ? `/groups/community/${group.id}`
    : `/groups/${group.id}`;

  const owner = group.members.find((m) => m.role === "owner") ?? group.members[0];
  const category = "category" in group && group.category ? (group.category as string) : null;

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-cream-dark bg-cream-paper shadow-[0_2px_8px_rgba(26,23,20,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
    >
      {/* Cover area */}
      <div className="relative flex h-28 w-full items-center justify-center bg-[#eae8e3]">
        {group.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={group.coverImage}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-paper/70 text-3xl shadow-sm">
            ⭐
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1.5 px-4 pt-3 pb-2">
        {/* Category */}
        {category && (
          <p className="text-[0.62rem] font-bold uppercase tracking-widest text-ink-muted">
            {category}
          </p>
        )}

        {/* Name */}
        <h3 className="font-serif text-base font-bold leading-snug text-ink line-clamp-1">
          {group.name}
        </h3>

        {/* Description */}
        {group.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-ink-muted">
            {group.description}
          </p>
        )}

        {/* Creator row */}
        {owner && (
          <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
            <Crown className="h-3 w-3 text-gold" />
            <span>by <span className="font-medium text-ink">{owner.name ?? owner.username ?? "Someone"}</span></span>
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-cream-dark px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {group.members.slice(0, 3).map((m) => (
              <MemberAvatar key={m.id} name={m.name} image={m.image} />
            ))}
          </div>
          <span className="flex items-center gap-1 text-xs text-ink-muted">
            <Users className="h-3 w-3" />
            {group.memberCount}
          </span>
        </div>
        <span className="rounded-full border border-cream-dark px-3 py-1 text-xs font-semibold text-ink transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-cream-paper">
          →
        </span>
      </div>
    </Link>
  );
}
