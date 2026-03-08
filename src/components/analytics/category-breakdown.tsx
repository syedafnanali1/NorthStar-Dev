// src/components/analytics/category-breakdown.tsx
import type { CategoryBreakdown as CategoryBreakdownType } from "@/server/services/analytics.service";

interface CategoryBreakdownProps {
  categories: CategoryBreakdownType[];
}

export function CategoryBreakdown({ categories }: CategoryBreakdownProps) {
  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <div key={cat.category}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span>{cat.emoji}</span>
              <span className="text-sm font-medium text-ink">{cat.label}</span>
              <span className="text-2xs text-ink-muted">
                {cat.goalCount} {cat.goalCount === 1 ? "goal" : "goals"}
              </span>
            </div>
            <span className="text-sm font-mono font-semibold text-ink">
              {cat.avgProgress}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-cream-dark overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${cat.avgProgress}%`, background: cat.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
