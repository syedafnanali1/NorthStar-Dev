"use client";

// src/components/ui/xp-toast.tsx
// Listens for 'northstar:xp' custom events and shows floating XP toasts.

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/index";

interface XpEvent {
  amount: number;
  action: string;
}

interface ToastItem {
  id: number;
  amount: number;
  action: string;
  visible: boolean;
}

let toastId = 0;

export function XpToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { amount, action } = (e as CustomEvent<XpEvent>).detail;
      const id = ++toastId;

      setToasts((prev) => [...prev, { id, amount, action, visible: true }]);

      // Start fade-out after 1.6s, remove after 2s
      setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, visible: false } : t))
        );
      }, 1600);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2100);
    };

    window.addEventListener("northstar:xp", handler);
    return () => window.removeEventListener("northstar:xp", handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-2">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{ transform: `translateY(${index * -4}px)` }}
          className={cn(
            "flex items-center gap-2 rounded-full border border-[#C4963A]/40 px-4 py-2 shadow-lg backdrop-blur-sm transition-all duration-500",
            "bg-[#1A1610]/90",
            toast.visible
              ? "translate-y-0 opacity-100"
              : "-translate-y-3 opacity-0"
          )}
        >
          <span className="text-base leading-none">⭐</span>
          <span className="font-mono text-sm font-semibold text-[#E8C97A]">
            +{toast.amount} XP
          </span>
          <span className="text-xs text-white/40 capitalize">
            {toast.action.replace(/_/g, " ")}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Dispatch an XP award event from anywhere in the app. */
export function dispatchXp(amount: number, action: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<XpEvent>("northstar:xp", { detail: { amount, action } })
  );
}
