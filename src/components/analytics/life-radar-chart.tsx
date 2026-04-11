"use client";

// src/components/analytics/life-radar-chart.tsx
// Recharts RadarChart with 6 category axes (0-100 score each)

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import type { CategoryBreakdown } from "@/server/services/analytics.service";

interface LifeRadarChartProps {
  categories: CategoryBreakdown[];
}

const AXIS_ORDER = ["health", "finance", "writing", "body", "mindset", "custom"] as const;
const AXIS_LABELS: Record<string, string> = {
  health: "Health",
  finance: "Finance",
  writing: "Creative",
  body: "Body",
  mindset: "Mindset",
  custom: "Custom",
};

export function LifeRadarChart({ categories }: LifeRadarChartProps) {
  const categoryMap = new Map(categories.map((c) => [c.category, c.avgProgress]));

  const data = AXIS_ORDER.map((key) => ({
    subject: AXIS_LABELS[key] ?? key,
    score: categoryMap.get(key) ?? 0,
    fullMark: 100,
  }));

  const lifeScore = Math.round(
    data.reduce((sum, d) => sum + d.score, 0) / data.length
  );

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative w-full max-w-xs flex-shrink-0 sm:max-w-[280px]">
        <ResponsiveContainer width="100%" aspect={1}>
          <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
            <PolarGrid stroke="rgba(0,0,0,0.08)" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: "#8B7355", fontSize: 11, fontWeight: 600 }}
            />
            <Radar
              name="Score"
              dataKey="score"
              stroke="#C4963A"
              fill="#C4963A"
              fillOpacity={0.3}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex-1 text-center sm:text-left">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
          Life Score
        </p>
        <p className="mt-2 font-serif text-5xl font-bold text-ink">
          {lifeScore}
          <span className="ml-1 text-xl text-ink-muted">/100</span>
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          Average across all tracked goal categories
        </p>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2">
          {data.map((d) => (
            <div key={d.subject} className="flex items-center justify-between gap-2">
              <span className="text-xs text-ink-muted">{d.subject}</span>
              <span className="font-mono text-xs font-semibold text-[#C4963A]">
                {d.score}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
