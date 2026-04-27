"use client";

// Rendered client-side only to avoid Math.random() hydration mismatch.
import { useMemo } from "react";

export function StarField() {
  const stars = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        key: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: Math.random() > 0.7 ? "2px" : "1px",
        opacity: Math.random() * 0.65,
        delay: `${Math.random() * 3}s`,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((s) => (
        <div
          key={s.key}
          className="absolute rounded-full bg-white animate-twinkle"
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, opacity: s.opacity, animationDelay: s.delay }}
        />
      ))}
    </div>
  );
}
