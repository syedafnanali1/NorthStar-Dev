"use client";

interface StreakVisualizationProps {
  currentStreak: number;
}

export function StreakVisualization({ currentStreak }: StreakVisualizationProps) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: Math.min(currentStreak, 7) }).map((_, i) => (
        <div
          key={i}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#C4963A]/20 border border-[#C4963A]/40"
        >
          <span className="text-sm font-bold text-[#E8C97A]">{i + 1}</span>
        </div>
      ))}
      {currentStreak > 7 && (
        <div className="text-sm text-white/50">
          +{currentStreak - 7} more
        </div>
      )}
    </div>
  );
}
