"use client";

// src/components/notifications/badge-unlock-modal.tsx
// Celebration popup modal that appears when a user earns a badge/achievement.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";

const BADGE_CONFIG: Record<string, { emoji: string; name: string; color: string; description: string }> = {
  first_goal_created:    { emoji: "🎯", name: "Goal Setter",      color: "bg-blue-50 border-blue-200",    description: "You created your first goal. The journey begins!" },
  first_checkin:         { emoji: "✅", name: "First Check-in",   color: "bg-emerald-50 border-emerald-200", description: "You checked in for the first time. Consistency starts here." },
  streak_7:              { emoji: "🔥", name: "7-Day Streak",     color: "bg-amber-50 border-amber-200",   description: "7 days in a row. You're building a real habit." },
  streak_30:             { emoji: "🏆", name: "Month Warrior",    color: "bg-gold/10 border-gold/40",      description: "30 days straight. You have exceptional discipline." },
  streak_60:             { emoji: "💎", name: "Diamond Streak",   color: "bg-purple-50 border-purple-200", description: "60 consecutive days. You are unstoppable." },
  streak_100:            { emoji: "👑", name: "Century Club",     color: "bg-gold/20 border-gold",         description: "100 days! You've crossed into elite territory." },
  circle_friend_added:   { emoji: "🤝", name: "Circle Builder",   color: "bg-sky-50 border-sky-200",       description: "You've added someone to your Circle. Accountability unlocked." },
  goal_completed:        { emoji: "🌟", name: "Goal Crusher",     color: "bg-gold/10 border-gold/40",      description: "You completed a goal. Every finish line matters." },
  goals_5:               { emoji: "🎖️", name: "Multi-Achiever",  color: "bg-emerald-50 border-emerald-200", description: "5 goals completed. You're building real momentum." },
  early_bird:            { emoji: "🌅", name: "Early Bird",       color: "bg-amber-50 border-amber-200",   description: "You checked in before 8am. Rise and shine!" },
  group_joined:          { emoji: "🏘️", name: "Community Member", color: "bg-sky-50 border-sky-200",      description: "You joined a group. Better together." },
  level_up:              { emoji: "⭐", name: "Level Up!",        color: "bg-gold/15 border-gold/40",      description: "You leveled up! Your dedication is paying off." },
};

function getConfig(key: string) {
  return BADGE_CONFIG[key] ?? {
    emoji: "🏅",
    name: "Achievement Unlocked",
    color: "bg-gold/10 border-gold/30",
    description: "You earned a new badge!",
  };
}

interface BadgeUnlockModalProps {
  achievementKey: string;
  onClose: () => void;
}

export function BadgeUnlockModal({ achievementKey, onClose }: BadgeUnlockModalProps) {
  const config = getConfig(achievementKey);

  // Auto-close after 6 seconds
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Card */}
      <motion.div
        className="relative z-10 w-full max-w-sm"
        initial={{ y: 60, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        <div className={`mx-4 mb-4 overflow-hidden rounded-3xl border-2 bg-cream-paper shadow-2xl sm:mx-0 ${config.color}`}>
          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-cream-paper/80 text-ink-muted transition hover:bg-cream-paper"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="px-7 py-8 text-center">
            {/* Sparkles decoration */}
            <div className="relative mb-4 inline-block">
              <motion.div
                className="flex h-24 w-24 items-center justify-center rounded-3xl bg-cream-paper text-5xl shadow-sm"
                initial={{ scale: 0.5, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 18 }}
              >
                {config.emoji}
              </motion.div>
              <motion.div
                className="absolute -right-2 -top-2"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Sparkles className="h-6 w-6 text-gold" />
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <p className="text-[11px] font-bold uppercase tracking-widest text-gold">Achievement Unlocked</p>
              <h2 className="mt-1 font-serif text-2xl font-bold text-ink">{config.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{config.description}</p>
            </motion.div>

            <motion.button
              type="button"
              onClick={onClose}
              className="btn-gold mt-6 w-full"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              Awesome! 🎉
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Auto-show hook — polls for unread achievement notifications ────────────────

export function useBadgePopup() {
  const [badge, setBadge] = useState<string | null>(null);
  const [shownIds] = useState(() => new Set<string>());

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok) return;
        const data = (await res.json()) as { notifications: Array<{ id: string; type: string; isRead: boolean; metadata: Record<string, unknown> }> };
        const unreadBadge = data.notifications.find(
          (n) => n.type === "achievement_unlocked" && !n.isRead && !shownIds.has(n.id)
        );
        if (unreadBadge) {
          shownIds.add(unreadBadge.id);
          const key = String(unreadBadge.metadata?.achievementKey ?? "achievement_unlocked");
          setBadge(key);
          // Mark as read
          void fetch(`/api/notifications/${unreadBadge.id}`, { method: "PATCH" });
        }
      } catch { /* silent */ }
    }

    void check();
    const interval = setInterval(check, 45_000);
    return () => clearInterval(interval);
  }, [shownIds]);

  return { badge, clearBadge: () => setBadge(null) };
}
