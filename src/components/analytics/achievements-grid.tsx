// src/components/analytics/achievements-grid.tsx
import { cn } from "@/lib/utils";
import type { Achievement } from "@/server/services/achievements.service";

interface AchievementsGridProps {
  achievements: Array<Achievement & { earned: boolean; earnedAt?: Date }>;
}

export function AchievementsGrid({ achievements }: AchievementsGridProps) {
  const earned = achievements.filter((a) => a.earned).length;

  return (
    <div>
      <p className="text-xs text-ink-muted mb-4">
        {earned} / {achievements.length} unlocked
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {achievements.map((a) => (
          <div
            key={a.key}
            title={a.description}
            className={cn(
              "p-4 rounded-2xl border-[1.5px] text-center transition-all",
              a.earned
                ? "border-cream-dark bg-cream-paper"
                : "border-cream-dark bg-cream opacity-35 grayscale"
            )}
          >
            <div className="text-3xl mb-2">{a.emoji}</div>
            <div className="text-xs font-semibold text-ink leading-tight mb-0.5">
              {a.title}
            </div>
            <div className="text-2xs text-ink-muted leading-tight">
              {a.description}
            </div>
            {a.earned && a.earnedAt && (
              <div className="mt-1.5 text-2xs font-mono text-gold">
                ✓ Earned
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
