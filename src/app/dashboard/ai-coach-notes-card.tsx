"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import type { RankedInsight } from "@/app/api/analytics/insights/route";

interface CoachNote {
  dot: "green" | "amber" | "blue";
  text: string;
  href?: string;
}

function insightsToNotes(insights: RankedInsight[]): CoachNote[] {
  if (insights.length === 0) {
    return [
      { dot: "green", text: "All caught up — no urgent actions right now." },
      { dot: "blue", text: "Keep logging daily to build momentum." },
    ];
  }

  const notes: CoachNote[] = [];

  const spike = insights.find((i) => i.type === "momentum_spike");
  const atRisk = insights.filter((i) => i.type === "at_risk");
  const streakRisk = insights.find((i) => i.type === "streak_risk");
  const close = insights.filter((i) => i.type === "completion_close");
  const gaps = insights.filter((i) => i.type === "intention_gap");

  if (spike) {
    notes.push({ dot: "green", text: spike.body });
  }
  if (close.length > 0) {
    notes.push({ dot: "green", text: close[0]!.body, href: close[0]!.ctaHref });
  }

  if (atRisk.length > 0) {
    notes.push({ dot: "amber", text: atRisk[0]!.body, href: atRisk[0]!.ctaHref });
  }
  if (streakRisk) {
    notes.push({ dot: "amber", text: streakRisk.body, href: streakRisk.ctaHref });
  }

  if (gaps.length > 0) {
    notes.push({ dot: "blue", text: gaps[0]!.body, href: gaps[0]!.ctaHref });
  }

  const remaining = insights.filter(
    (i) => !["momentum_spike", "at_risk", "streak_risk", "completion_close", "intention_gap"].includes(i.type)
  );
  for (const r of remaining.slice(0, 2 - notes.filter((n) => n.dot === "blue").length)) {
    notes.push({ dot: "blue", text: r.body, href: r.ctaHref });
  }

  return notes.slice(0, 4);
}

const DOT_COLOR: Record<CoachNote["dot"], string> = {
  green: "bg-emerald-400",
  amber: "bg-amber-400",
  blue: "bg-sky-400",
};

export function AiCoachNotesCard() {
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics/insights")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { insights: RankedInsight[] } | null) => {
        setNotes(insightsToNotes(d?.insights ?? []));
      })
      .catch(() => setNotes(insightsToNotes([])))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      className="rounded-2xl border overflow-hidden flex flex-col"
      style={{
        background: "var(--cream-paper)",
        borderColor: "var(--cream-dark)",
        borderLeft: "3px solid #7F77DD",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: "1px solid var(--cream-dark)" }}>
        <div
          className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center"
          style={{ background: "rgba(127,119,221,0.12)" }}
        >
          <Sparkles className="h-4 w-4" style={{ color: "#7F77DD" }} />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "#7F77DD" }}>
            AI Coach Notes
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--ink-muted)" }}>
            Personalised to your progress
          </p>
        </div>
      </div>

      {/* Notes list */}
      <div className="flex-1 px-4 py-3 space-y-2.5">
        {loading ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-start gap-2 animate-pulse">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-cream-dark flex-shrink-0" />
                <div className="h-3 bg-cream-dark rounded flex-1" style={{ width: `${70 + i * 10}%` }} />
              </div>
            ))}
          </div>
        ) : (
          notes.map((note, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className={`mt-[5px] h-1.5 w-1.5 rounded-full flex-shrink-0 ${DOT_COLOR[note.dot]}`} />
              {note.href ? (
                <Link
                  href={note.href}
                  className="text-xs leading-relaxed hover:underline underline-offset-2"
                  style={{ color: "var(--ink-soft)" }}
                >
                  {note.text}
                </Link>
              ) : (
                <p className="text-xs leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  {note.text}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-3">
        <Link
          href="/analytics"
          className="text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors hover:opacity-80"
          style={{ color: "#7F77DD" }}
        >
          Full insights →
        </Link>
      </div>
    </div>
  );
}
