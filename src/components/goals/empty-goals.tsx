// src/components/goals/empty-goals.tsx
import Link from "next/link";

export function EmptyGoals() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-6xl mb-5">⭐</div>
      <h2 className="text-2xl font-serif font-semibold text-ink mb-3">
        Plant your first star
      </h2>
      <p className="text-sm text-ink-muted max-w-sm mb-8 leading-relaxed">
        Every extraordinary journey begins with a single decision to begin.
        Create your first goal and start tracking your progress.
      </p>
      <Link href="/goals/new" className="btn-primary">
        Create Your First Goal
      </Link>

      {/* Category preview */}
      <div className="grid grid-cols-3 gap-3 mt-12 w-full max-w-sm">
        {[
          { emoji: "🏃", label: "Health", color: "#6B8C7A" },
          { emoji: "💰", label: "Finance", color: "#5B7EA6" },
          { emoji: "✍️", label: "Writing", color: "#C4963A" },
          { emoji: "⚖️", label: "Body", color: "#B5705B" },
          { emoji: "🧠", label: "Mindset", color: "#7B6FA0" },
          { emoji: "⭐", label: "Custom", color: "#C4963A" },
        ].map((cat) => (
          <div
            key={cat.label}
            className="card p-4 text-center opacity-50"
          >
            <div className="text-2xl mb-1">{cat.emoji}</div>
            <div className="text-xs text-ink-muted">{cat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
