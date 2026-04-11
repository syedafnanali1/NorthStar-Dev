// src/components/analytics/category-breakdown.tsx
import type { CategoryBreakdown as CategoryBreakdownType } from "@/server/services/analytics.service";

interface CategoryBreakdownProps {
  categories: CategoryBreakdownType[];
}

export function CategoryBreakdown({ categories }: CategoryBreakdownProps) {
  return (
    <>
      <div className="hidden space-y-4 lg:block">
        {categories.map((category) => (
          <div key={category.category} className="flex items-center gap-4">
            <div className="flex min-w-[230px] items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: category.color }}
              />
              <span className="text-base text-ink">
                {category.emoji} {category.label} ({category.goalCount})
              </span>
            </div>
            <div className="flex flex-1 items-center gap-4">
              <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-cream-dark">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${category.avgProgress}%`,
                    background: category.color,
                  }}
                />
              </div>
              <span className="w-8 text-right text-xs font-mono text-ink-muted">
                {category.avgProgress}%
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4 lg:hidden">
        {categories.map((category) => (
          <div key={category.category}>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{category.emoji}</span>
                <span className="text-sm font-medium text-ink">{category.label}</span>
                <span className="text-2xs text-ink-muted">
                  {category.goalCount} {category.goalCount === 1 ? "goal" : "goals"}
                </span>
              </div>
              <span className="text-sm font-mono font-semibold text-ink">
                {category.avgProgress}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-cream-dark">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${category.avgProgress}%`, background: category.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
