// src/components/analytics/achievements-grid.tsx
import { cn } from "@/lib/utils";
import type { Achievement } from "@/server/services/achievements.service";

interface AchievementsGridProps {
  achievements: Array<Achievement & { earned: boolean; earnedAt?: Date }>;
}

export function AchievementsGrid({ achievements }: AchievementsGridProps) {
  const earned = achievements.filter((a) => a.earned).length;

  return (
    <>
      <div className="hidden lg:block">
        <div className="grid grid-cols-8 gap-2.5 xl:grid-cols-10">
          {achievements.map((achievement) => (
            <div
              key={achievement.key}
              title={achievement.description}
              className={cn(
                "flex min-h-[92px] flex-col items-center justify-center rounded-2xl border px-2 text-center transition-all",
                achievement.earned
                  ? "border-gold/70 bg-cream-paper"
                  : "border-cream-dark bg-cream opacity-35 grayscale"
              )}
            >
              <div className="text-2xl">{achievement.emoji}</div>
              <div className="mt-2 text-[11px] font-semibold uppercase leading-tight tracking-[0.08em] text-ink">
                {achievement.title}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:hidden">
        <p className="mb-4 text-xs text-ink-muted">
          {earned} / {achievements.length} unlocked
        </p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {achievements.map((achievement) => (
            <div
              key={achievement.key}
              title={achievement.description}
              className={cn(
                "rounded-2xl border-[1.5px] p-4 text-center transition-all",
                achievement.earned
                  ? "border-cream-dark bg-cream-paper"
                  : "border-cream-dark bg-cream opacity-35 grayscale"
              )}
            >
              <div className="mb-2 text-3xl">{achievement.emoji}</div>
              <div className="mb-0.5 text-xs font-semibold leading-tight text-ink">
                {achievement.title}
              </div>
              <div className="text-2xs leading-tight text-ink-muted">
                {achievement.description}
              </div>
              {achievement.earned && achievement.earnedAt ? (
                <div className="mt-1.5 text-2xs font-mono text-gold">
                  ✓ Earned
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
