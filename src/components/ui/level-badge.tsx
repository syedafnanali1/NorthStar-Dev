"use client";

// src/components/ui/level-badge.tsx
// Small "Lvl N" pill in gold. Hover reveals XP progress bar.

import { useState } from "react";
import { cn } from "@/lib/utils/index";
import { xpForLevel } from "@/server/services/xp.service";

interface LevelBadgeProps {
  level: number;
  xpPoints: number;
  className?: string;
}

export function LevelBadge({ level, xpPoints, className }: LevelBadgeProps) {
  const [hovered, setHovered] = useState(false);

  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const progress = nextLevelXp > currentLevelXp
    ? Math.min(1, (xpPoints - currentLevelXp) / (nextLevelXp - currentLevelXp))
    : 1;
  const progressPct = Math.round(progress * 100);

  return (
    <div
      className={cn("relative inline-block", className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Pill */}
      <div className="flex cursor-default items-center gap-1 rounded-full border border-[#C4963A]/50 bg-[#1A1610] px-2.5 py-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#C4963A]">
          Lvl
        </span>
        <span className="font-mono text-sm font-bold text-[#E8C97A]">{level}</span>
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div className="absolute bottom-full left-1/2 mb-2 w-44 -translate-x-1/2 rounded-xl border border-[#2A2522] bg-[#141210] p-3 shadow-xl">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C7AF7A]">
              Level {level}
            </span>
            <span className="font-mono text-[10px] text-white/50">
              {xpPoints} / {nextLevelXp} XP
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-[#C4963A] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-white/35">
            {nextLevelXp - xpPoints} XP to Level {level + 1}
          </p>
          {/* Arrow */}
          <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-[#2A2522] bg-[#141210]" />
        </div>
      )}
    </div>
  );
}
