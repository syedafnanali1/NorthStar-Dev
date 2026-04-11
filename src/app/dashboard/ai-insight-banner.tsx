"use client";

// src/app/dashboard/ai-insight-banner.tsx
// Thin client wrapper that holds the dismissal state for the CoachMessageCard.

import { useState } from "react";
import { CoachMessageCard } from "@/components/ai/coach-message-card";
import type { AiInsight } from "@/drizzle/schema";

interface AiInsightBannerProps {
  insight: AiInsight;
}

export function AiInsightBanner({ insight }: AiInsightBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <CoachMessageCard
      insightId={insight.id}
      message={insight.content}
      type={insight.type}
      onDismiss={() => setDismissed(true)}
    />
  );
}
