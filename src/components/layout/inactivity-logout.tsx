"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
];

export function InactivityLogout() {
  const { status } = useSession();
  const pathname = usePathname();
  const timerRef = useRef<number | null>(null);
  const signOutTriggeredRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      signOutTriggeredRef.current = false;
      return;
    }

    if (pathname.startsWith("/auth/")) return;

    const resetTimer = () => {
      if (signOutTriggeredRef.current) return;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        signOutTriggeredRef.current = true;
        void signOut({ callbackUrl: "/auth/login?inactive=1" });
      }, INACTIVITY_TIMEOUT_MS);
    };

    const handleActivity = () => resetTimer();
    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity);
    });

    resetTimer();

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
    };
  }, [status, pathname]);

  return null;
}
