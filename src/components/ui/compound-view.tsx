"use client";

// src/components/ui/compound-view.tsx
// Full-screen 1% compound interest visualization overlay.

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface CompoundViewProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CompoundView({ isOpen, onClose }: CompoundViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const BG = "#0E0C0A";
    const GOLD = "#C4963A";
    const N = 365;
    const PAD = { top: 40, right: 50, bottom: 48, left: 50 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // Compound values: y = (1.01^x - 1) / (1.01^365 - 1) * plotH, inverted
    const maxVal = Math.pow(1.01, N) - 1;
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i <= N; i++) {
      const val = (Math.pow(1.01, i) - 1) / maxVal;
      points.push({
        x: PAD.left + (i / N) * plotW,
        y: PAD.top + plotH - val * plotH,
      });
    }

    // Baseline (0% improvement) — flat line
    ctx.beginPath();
    ctx.moveTo(PAD.left, PAD.top + plotH);
    ctx.lineTo(PAD.left + plotW, PAD.top + plotH);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Gold gradient fill under curve
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + plotH);
    grad.addColorStop(0, "rgba(196,150,58,0.22)");
    grad.addColorStop(1, "rgba(196,150,58,0)");
    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i]!.x, points[i]!.y);
    }
    ctx.lineTo(PAD.left + plotW, PAD.top + plotH);
    ctx.lineTo(PAD.left, PAD.top + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Curve stroke
    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i]!.x, points[i]!.y);
    }
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.font = "11px DM Sans, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Day 1", PAD.left, H - 10);
    ctx.textAlign = "right";
    ctx.fillText("Day 365", PAD.left + plotW, H - 10);

    // "0% improvement" baseline label
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillText("0% improvement", PAD.left + 6, PAD.top + plotH - 8);

    // "3641% growth" peak label
    const peak = points[N]!;
    ctx.textAlign = "right";
    ctx.fillStyle = GOLD;
    ctx.font = "bold 13px DM Sans, sans-serif";
    ctx.fillText("3641% growth", peak.x - 4, peak.y + 16);

    // Draw dot at peak
    ctx.beginPath();
    ctx.arc(peak.x, peak.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = GOLD;
    ctx.fill();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0E0C0A" }}>
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/50 transition hover:border-white/40 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Label */}
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.35em]"
          style={{ color: "#C4963A" }}
        >
          The 1% View
        </p>

        {/* Headline */}
        <div className="mt-4 text-center" style={{ fontSize: "clamp(34px, 5vw, 58px)", lineHeight: 1.05 }}>
          <p className="font-serif font-semibold text-white">Small actions,</p>
          <p className="font-serif font-semibold text-white">extraordinary results.</p>
        </div>

        {/* Subtitle */}
        <p className="mt-3 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
          What 1% daily improvement looks like over 365 days
        </p>

        {/* Canvas */}
        <div className="relative mt-8 w-full max-w-2xl" style={{ height: "280px" }}>
          <canvas
            ref={canvasRef}
            style={{ display: "block", width: "100%", height: "100%" }}
            aria-label="Compound growth curve"
          />
        </div>

        {/* Quote */}
        <p
          className="mt-8 max-w-xl text-center font-serif text-base italic leading-7"
          style={{ color: "#D8B665" }}
        >
          &ldquo;You are not behind. You are not failing. You are in the most important part — the
          part where it&apos;s hard and you&apos;re still doing it anyway.&rdquo;
        </p>
      </div>
    </div>
  );
}
