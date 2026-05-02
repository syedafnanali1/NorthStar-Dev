"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import Link from "next/link";
import { isEnabled } from "@/lib/feature-flags";

const NUDGE_SESSION_KEY = "ns_nudge_shown";

type NudgeVariant = "post_checkin" | "post_goal_create" | "at_risk_goal" | "streak_milestone";

interface NudgeConfig {
  emoji: string;
  headline: string;
  body: string;
  cta: string;
  href: string;
}

const NUDGE_CONFIGS: Record<NudgeVariant, NudgeConfig> = {
  post_checkin: {
    emoji: "📊",
    headline: "Great check-in!",
    body: "See how your efforts stack up over time.",
    cta: "View Analytics",
    href: "/analytics",
  },
  post_goal_create: {
    emoji: "👥",
    headline: "Stronger together",
    body: "Add accountability partners — goals with a circle are 3× more likely to stick.",
    cta: "Find your Circle",
    href: "/circle",
  },
  at_risk_goal: {
    emoji: "⚠️",
    headline: "A goal needs attention",
    body: "One of your goals is at risk of missing its deadline.",
    cta: "Review Goals",
    href: "/dashboard",
  },
  streak_milestone: {
    emoji: "🔥",
    headline: "You're on a roll!",
    body: "Keep the momentum — check your progress story.",
    cta: "View Analytics",
    href: "/analytics",
  },
};

interface CrossTabNudgeProps {
  variant?: NudgeVariant;
  autoShow?: boolean;
  delayMs?: number;
}

export function CrossTabNudge({
  variant = "post_checkin",
  autoShow = false,
  delayMs = 3000,
}: CrossTabNudgeProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isEnabled("crossTabNudges")) return;
    if (!autoShow) return;

    // Frequency cap: max 1 nudge per session
    if (sessionStorage.getItem(NUDGE_SESSION_KEY)) return;

    const t = setTimeout(() => {
      setVisible(true);
      sessionStorage.setItem(NUDGE_SESSION_KEY, "1");
    }, delayMs);

    return () => clearTimeout(t);
  }, [autoShow, delayMs]);

  const config = NUDGE_CONFIGS[variant];

  const dismiss = () => setVisible(false);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="fixed bottom-24 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 lg:bottom-8"
        >
          <div className="rounded-2xl border border-cream-dark bg-cream-paper shadow-2xl p-4 flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">{config.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">{config.headline}</p>
              <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{config.body}</p>
              <Link
                href={config.href}
                onClick={dismiss}
                className="mt-2 inline-block text-xs font-semibold text-gold hover:underline"
              >
                {config.cta} →
              </Link>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="flex-shrink-0 p-1 rounded-lg text-ink-muted hover:bg-cream-dark transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
