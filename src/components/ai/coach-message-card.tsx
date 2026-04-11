"use client";

// src/components/ai/coach-message-card.tsx
// Displays an AI coaching message with an animated text reveal and dismiss button.

import { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";
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

export function CoachMessageCard({
  insightId,
  message,
  type,
  goalTitle,
  onDismiss,
}: CoachMessageCardProps) {
  const [dismissing, setDismissing] = useState(false);

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
        "relative overflow-hidden rounded-3xl border border-gold/20 bg-ink p-5 transition-all duration-300 sm:p-6",
        dismissing && "scale-95 opacity-0"
      )}
    >
      {/* Gold left accent bar */}
      <div className="absolute inset-y-0 left-0 w-1 rounded-l-3xl bg-gold" />

      <div className="pl-4">
        {/* Header row */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-gold" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-gold">
              AI Coach — {TYPE_LABELS[type] ?? type}
            </span>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded-full p-1 text-white/30 transition hover:text-white/70"
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

        {/* Message with staggered word reveal */}
        <p className="text-sm leading-6 text-white/85">
          <AnimatedText text={message} />
        </p>
      </div>
    </div>
  );
}
