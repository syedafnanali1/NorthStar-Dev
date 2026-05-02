// Feature flags — controlled via env vars, overrideable in localStorage for dev.
// All flags default to ON so production works without env configuration.

const FLAGS = {
  intentionsSystem:   process.env["NEXT_PUBLIC_FF_INTENTIONS"]   !== "false",
  analyticsInsights:  process.env["NEXT_PUBLIC_FF_INSIGHTS"]     !== "false",
  analyticsEvents:    process.env["NEXT_PUBLIC_FF_EVENTS"]       !== "false",
  crossTabNudges:     process.env["NEXT_PUBLIC_FF_NUDGES"]       !== "false",
  navBadges:          process.env["NEXT_PUBLIC_FF_NAV_BADGES"]   !== "false",
  statsGlanceCards:   process.env["NEXT_PUBLIC_FF_GLANCE_CARDS"] !== "false",
  goalStatsLevel2:    process.env["NEXT_PUBLIC_FF_GOAL_STATS"]   !== "false",
} as const;

export type FeatureFlag = keyof typeof FLAGS;

export function isEnabled(flag: FeatureFlag): boolean {
  if (typeof window === "undefined") return FLAGS[flag];
  const override = localStorage.getItem(`ff_${flag}`);
  if (override === "true") return true;
  if (override === "false") return false;
  return FLAGS[flag];
}

// Dev helper: call in browser console to toggle a flag
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>)["setFlag"] = (flag: string, value: boolean) => {
    localStorage.setItem(`ff_${flag}`, String(value));
    window.location.reload();
  };
}
