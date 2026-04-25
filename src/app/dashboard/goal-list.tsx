"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { GoalCard } from "@/components/goals/goal-card";
import { EmptyGoals } from "@/components/goals/empty-goals";
import { cn } from "@/lib/utils";
import type { GoalWithDetails } from "@/server/services/goals.service";

const CATEGORIES = [
  { key: "all",     label: "All"        },
  { key: "health",  label: "🏃 Health"  },
  { key: "finance", label: "💰 Finance" },
  { key: "writing", label: "✍️ Writing" },
  { key: "body",    label: "⚖️ Body"    },
  { key: "mindset", label: "🧠 Mindset" },
  { key: "custom",  label: "⭐ Custom"  },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  health: "Health",
  finance: "Finance",
  writing: "Writing",
  body: "Body",
  mindset: "Mindset",
  custom: "Custom",
};

interface GoalListProps {
  goals: GoalWithDetails[];
  circleMembers?: Array<{ id: string; name: string | null; image: string | null; streak: number }>;
}

export function GoalList({ goals, circleMembers = [] }: GoalListProps) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  const normalizedQuery = query.trim().toLowerCase();

  /* ── Autocomplete suggestions ─── */
  const suggestions = useMemo(() => {
    if (normalizedQuery.length < 2) return [];
    const seen = new Set<string>();
    const results: string[] = [];

    for (const goal of goals) {
      if (results.length >= 6) break;
      const candidates = [
        goal.title,
        goal.why,
        CATEGORY_LABELS[goal.category],
        ...goal.tasks.map((t) => t.text),
        ...(goal.milestones ?? []),
      ].filter(Boolean) as string[];

      for (const text of candidates) {
        const lower = text.toLowerCase();
        if (lower.includes(normalizedQuery) && !seen.has(lower)) {
          seen.add(lower);
          results.push(text);
          if (results.length >= 6) break;
        }
      }
    }
    return results;
  }, [normalizedQuery, goals]);

  /* ── Close dropdown on outside click ─── */
  useEffect(() => {
    if (!showSuggestions) return;
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSuggestions]);

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

  const handleSelectSuggestion = (text: string) => {
    setQuery(text);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  return (
    <section className="space-y-4">
      {goals.length === 0 ? (
        <EmptyGoals />
      ) : (
        <>
          {/* ── Search with autocomplete ─── */}
          <div ref={searchRef} className="relative">
            <label className={cn(
              "flex h-10 items-center gap-2.5 rounded-xl border bg-cream-paper px-3.5 transition-colors",
              showSuggestions && suggestions.length > 0
                ? "rounded-b-none border-b-0 border-ink-muted"
                : "border-cream-dark focus-within:border-ink-muted"
            )}>
              <Search className="h-3.5 w-3.5 flex-shrink-0 text-ink-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                placeholder="Search goals, intentions, why…"
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(""); setShowSuggestions(false); }}
                  className="flex-shrink-0 text-ink-muted transition-colors hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </label>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 z-20 overflow-hidden rounded-b-xl border border-t-0 border-ink-muted bg-cream-paper shadow-card-hover">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(s); }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink transition-colors hover:bg-cream"
                  >
                    <Search className="h-3 w-3 flex-shrink-0 text-ink-muted/60" />
                    {/* Bold the matching part */}
                    <span>
                      {(() => {
                        const idx = s.toLowerCase().indexOf(normalizedQuery);
                        if (idx === -1) return s;
                        return (
                          <>
                            {s.slice(0, idx)}
                            <span className="font-semibold text-ink">{s.slice(idx, idx + normalizedQuery.length)}</span>
                            {s.slice(idx + normalizedQuery.length)}
                          </>
                        );
                      })()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Category filters ─── */}
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

          {/* ── Count row ─── */}
          <div className="flex items-center gap-3">
            <p className="section-label lg:desktop-kicker">
              {filtered.length > 0
                ? `${filtered.length} goal${filtered.length !== 1 ? "s" : ""}`
                : "No goals match"}
            </p>
            <span className="h-px flex-1 bg-cream-dark" />
          </div>

          {/* ── Goal cards ─── */}
          {filtered.length === 0 ? (
            <div className="card px-5 py-10 text-center">
              <p className="text-sm italic text-ink-muted">No goals match that filter.</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {filtered.map((goal) => (
                <GoalCard key={goal.id} goal={goal} circleMembers={circleMembers} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
