"use client";

// src/components/ai/coach-message-card.tsx
// Displays an AI coaching message with an animated text reveal and dismiss button.
// First sentence is shown by default; the rest expands on "See more".

import { useState, useEffect } from "react";
import { X, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils/index";

const TYPE_LABELS: Record<string, string> = {
  weekly_review: "Weekly Review",
  nudge: "Accountability Nudge",
  correlation: "Habit Insight",
  suggestion: "Suggestion",
  prediction: "Progress Prediction",
};

interface CoachMessageCardProps {
  insightId: string;
  message: string;
  type: string;
  goalTitle?: string;
  onDismiss: () => void;
}

// Splits message into words for staggered reveal animation.
function AnimatedText({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <span>
      {words.map((word, i) => (
        <span
          key={i}
          className="inline-block animate-fade-up opacity-0"
          style={{
            animationDelay: `${i * 30}ms`,
            animationFillMode: "forwards",
          }}
        >
          {word}&nbsp;
        </span>
      ))}
    </span>
  );
}

// Returns the first sentence (or first ~120 chars) as the preview.
function getPreview(text: string): string {
  const match = text.match(/^.{30,}?[.!?](?:\s|$)/);
  if (match) return match[0].trim();
  return text.length > 120 ? text.slice(0, 117).trimEnd() + "…" : text;
}

export function CoachMessageCard({
  insightId,
  message,
  type,
  goalTitle,
  onDismiss,
}: CoachMessageCardProps) {
  const [dismissing, setDismissing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const preview = getPreview(message);
  const hasMore = preview.replace(/…$/, "").trimEnd().length < message.trimEnd().length;

  // Fire-and-forget mark-as-read on mount
  useEffect(() => {
    fetch("/api/ai/coach", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insightId }),
    }).catch(() => null);
  }, [insightId]);

  async function handleDismiss() {
    setDismissing(true);
    onDismiss();
  }

  return (
    <div
      className={cn(
        // Always dark background so text-white stays legible in both light and dark themes
        "relative overflow-hidden rounded-3xl border border-gold/20 bg-[#171411] p-4 transition-all duration-300 sm:p-5",
        dismissing && "scale-95 opacity-0"
      )}
    >
      {/* Gold left accent bar */}
      <div className="absolute inset-y-0 left-0 w-1 rounded-l-3xl bg-gold" />

      <div className="pl-4">
        {/* Header row */}
        <div className="mb-2.5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-gold" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-gold">
              AI Coach — {TYPE_LABELS[type] ?? type}
            </span>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded-full p-1.5 text-white/30 transition hover:text-white/70 active:scale-90"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Goal context if present */}
        {goalTitle ? (
          <p className="mb-2 text-xs text-white/40">
            Re: <span className="text-white/60">{goalTitle}</span>
          </p>
        ) : null}

        {/* Message — collapsed shows preview, expanded shows full animated text */}
        <p className="text-sm leading-[1.65] text-white/80">
          {expanded ? <AnimatedText text={message} /> : preview}
        </p>

        {/* See more / See less toggle */}
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2.5 flex items-center gap-1 text-xs font-semibold text-gold/75 transition-colors hover:text-gold active:scale-95"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                See less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                See more
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
