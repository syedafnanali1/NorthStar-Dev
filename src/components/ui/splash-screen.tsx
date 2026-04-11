"use client";

// src/components/ui/splash-screen.tsx
// First-visit animated splash screen. Uses sessionStorage to show once per session.

import { useEffect, useRef, useState } from "react";

const QUOTES = [
  "The secret of getting ahead is getting started.",
  "You don't rise to the level of your goals. You fall to the level of your systems.",
  "Discipline is the bridge between goals and accomplishment.",
  "One day or day one. You decide.",
  "Small consistent actions compound into extraordinary results.",
] as const;

// Deterministic star positions to avoid hydration issues
const STARS = Array.from({ length: 60 }, (_, i) => ({
  left: ((i * 37 + 11) % 97) + 1.5,
  top: ((i * 53 + 7) % 93) + 2,
  size: ((i * 17) % 3) + 1,
  delay: ((i * 23) % 28) / 10,
  duration: 2 + ((i * 13) % 18) / 10,
  opacity: 0.15 + ((i * 7) % 55) / 100,
}));

export function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]!);

  useEffect(() => {
    // Only show if not already seen this session
    try {
      if (sessionStorage.getItem("ns_splash_seen")) return;
      sessionStorage.setItem("ns_splash_seen", "1");
    } catch {
      return; // SSR or private mode
    }

    setVisible(true);

    // Draw compound curve on canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const dpr = window.devicePixelRatio || 1;
        const W = canvas.offsetWidth || 320;
        const H = canvas.offsetHeight || 80;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const N = 365;
        const PAD = 12;
        const plotW = W - PAD * 2;
        const plotH = H - PAD * 2;
        const maxVal = Math.pow(1.01, N) - 1;

        const points = Array.from({ length: N + 1 }, (_, i) => ({
          x: PAD + (i / N) * plotW,
          y: PAD + plotH - ((Math.pow(1.01, i) - 1) / maxVal) * plotH,
        }));

        // Fill
        const grad = ctx.createLinearGradient(0, PAD, 0, PAD + plotH);
        grad.addColorStop(0, "rgba(196,150,58,0.2)");
        grad.addColorStop(1, "rgba(196,150,58,0)");
        ctx.beginPath();
        ctx.moveTo(points[0]!.x, points[0]!.y);
        for (const p of points) ctx.lineTo(p.x, p.y);
        ctx.lineTo(PAD + plotW, PAD + plotH);
        ctx.lineTo(PAD, PAD + plotH);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Stroke
        ctx.beginPath();
        ctx.moveTo(points[0]!.x, points[0]!.y);
        for (const p of points) ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = "#C4963A";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Auto-close after 3.5s
    const fadeTimer = setTimeout(() => setFading(true), 3000);
    const hideTimer = setTimeout(() => setVisible(false), 3950);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9000] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: "#0E0C0A",
        opacity: fading ? 0 : 1,
        transform: fading ? "scale(1.04)" : "scale(1)",
        transition: fading ? "opacity 0.95s ease, transform 0.95s ease" : undefined,
        pointerEvents: fading ? "none" : undefined,
      }}
    >
      {/* Radial gold glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(196,150,58,0.08) 0%, transparent 70%)",
        }}
      />

      {/* Stars */}
      {STARS.map((s, i) => (
        <div
          key={i}
          className="pointer-events-none absolute rounded-full"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            background: "white",
            opacity: s.opacity,
            animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-8 text-center">
        {/* Star logo */}
        <div
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: "rgba(196,150,58,0.15)", border: "1px solid rgba(196,150,58,0.3)" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L14.4 9.6H22L15.8 14.4L18.2 22L12 17.2L5.8 22L8.2 14.4L2 9.6H9.6L12 2Z"
              fill="#C4963A"
            />
          </svg>
        </div>

        <p
          className="text-[11px] font-semibold uppercase tracking-[0.35em]"
          style={{ color: "#C4963A" }}
        >
          ⭐ North Star
        </p>

        <div className="mt-5" style={{ fontSize: "clamp(28px, 5vw, 46px)", lineHeight: 1.08 }}>
          <p className="font-serif font-semibold text-white">Small actions.</p>
          <p className="font-serif font-semibold text-white">Extraordinary results.</p>
        </div>

        <p className="mt-3 text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
          Your progress, compounded.
        </p>

        {/* Compound curve */}
        <div className="mt-6 w-full max-w-xs" style={{ height: "80px" }}>
          <canvas
            ref={canvasRef}
            style={{ display: "block", width: "100%", height: "80px" }}
            aria-hidden="true"
          />
        </div>

        {/* Quote */}
        <p
          className="mt-6 max-w-sm font-serif text-sm italic leading-6"
          style={{ color: "#D8B665" }}
        >
          &ldquo;{quote}&rdquo;
        </p>
      </div>

      {/* Loading bar */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[3px]"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="h-full"
          style={{
            background: "#C4963A",
            animation: "splash-load 3s linear forwards",
          }}
        />
      </div>

      <style>{`
        @keyframes splash-load {
          from { width: 0% }
          to { width: 100% }
        }
      `}</style>
    </div>
  );
}
