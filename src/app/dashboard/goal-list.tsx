"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { GoalCard } from "@/components/goals/goal-card";
import { EmptyGoals } from "@/components/goals/empty-goals";
import { cn } from "@/lib/utils";
import type { GoalWithDetails } from "@/server/services/goals.service";

const CATEGORIES = [
  { key: "all",     label: "All"          },
  { key: "health",  label: "🏃 Health"    },
  { key: "finance", label: "💰 Finance"   },
  { key: "writing", label: "✍️ Writing"   },
  { key: "body",    label: "⚖️ Body"      },
  { key: "mindset", label: "🧠 Mindset"   },
  { key: "custom",  label: "⭐ Custom"    },
] as const;

interface GoalListProps {
  goals: GoalWithDetails[];
}

export function GoalList({ goals }: GoalListProps) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = goals.filter((goal) => {
    if (activeCategory !== "all" && goal.category !== activeCategory) return false;
    if (!normalizedQuery) return true;
    const haystack = [
      goal.title,
      goal.why ?? "",
      goal.milestones?.join(" ") ?? "",
      goal.tasks.map((t) => t.text).join(" "),
    ].join(" ").toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  return (
    /* ── Single unified responsive goal list ───────────── */
    <section className="space-y-4">
      {goals.length === 0 ? (
        <EmptyGoals />
      ) : (
        <>
          {/* Search bar */}
          <label className="flex h-10 items-center gap-2.5 rounded-xl border border-cream-dark bg-cream-paper px-3.5 transition-colors focus-within:border-ink-muted">
            <Search className="h-3.5 w-3.5 flex-shrink-0 text-ink-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search goals, intentions, why…"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
            />
          </label>

          {/* Category filters — horizontal scroll on mobile, wrap on desktop */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide sm:flex-wrap sm:overflow-x-visible sm:pb-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setActiveCategory(cat.key)}
                className={cn(
                  "h-8 flex-shrink-0 rounded-full border px-3 text-sm font-medium transition-all",
                  activeCategory === cat.key
                    ? "border-ink bg-ink text-cream-paper"
                    : "border-cream-dark bg-cream-paper text-ink-muted hover:border-ink-muted hover:text-ink"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Count row */}
          <div className="flex items-center gap-3">
            <p className="section-label lg:desktop-kicker">
              {filtered.length > 0
                ? `${filtered.length} goal${filtered.length !== 1 ? "s" : ""}`
                : "No goals match"}
            </p>
            <span className="h-px flex-1 bg-cream-dark" />
          </div>

          {/* Goal cards */}
          {filtered.length === 0 ? (
            <div className="card px-5 py-10 text-center">
              <p className="text-sm italic text-ink-muted">No goals match that filter.</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {filtered.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
