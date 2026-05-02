"use client";

import { useEffect, useState } from "react";
import { isEnabled } from "@/lib/feature-flags";

interface NavBadges {
  notifications: number;
  groups: number;
  goals: number;
}

const POLL_INTERVAL_MS = 60_000;

export function useNavBadges(): NavBadges {
  const [badges, setBadges] = useState<NavBadges>({ notifications: 0, groups: 0, goals: 0 });

  useEffect(() => {
    if (!isEnabled("navBadges")) return;

    async function fetchBadges() {
      try {
        const res = await fetch("/api/nav/badges");
        if (res.ok) {
          const data = (await res.json()) as NavBadges;
          setBadges(data);
        }
      } catch {
        // silently ignore — badges are non-critical
      }
    }

    void fetchBadges();
    const id = setInterval(() => void fetchBadges(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return badges;
}
