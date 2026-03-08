// src/components/analytics/constellation-canvas.tsx
"use client";

import { useEffect, useRef } from "react";
import type { ConstellationPoint } from "@/server/services/analytics.service";

interface ConstellationCanvasProps {
  data: ConstellationPoint[];
  width?: number;
  height?: number;
}

export function ConstellationCanvas({
  data,
  width = 260,
  height = 150,
}: ConstellationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // HiDPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    if (data.length === 0) return;

    // Map dates to x positions, intensity to y + brightness
    const padding = 16;
    const plotW = width - padding * 2;
    const plotH = height - padding * 2;

    // Assign star positions: x = time, y = inverted intensity (active = high)
    const points = data.map((d, i) => ({
      x: padding + (i / Math.max(data.length - 1, 1)) * plotW,
      y: padding + plotH - d.intensity * plotH * 0.85 - (Math.random() * 12),
      intensity: d.intensity,
      date: d.date,
    }));

    // Draw connecting lines between active consecutive points
    ctx.save();
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      if (!prev || !curr) continue;
      if (prev.intensity > 0.1 && curr.intensity > 0.1) {
        const alpha = Math.min(prev.intensity, curr.intensity) * 0.3;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        ctx.strokeStyle = `rgba(196,150,58,${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    ctx.restore();

    // Draw stars
    for (const pt of points) {
      if (pt.intensity === 0) {
        // Faint inactive dot
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fill();
        continue;
      }

      const r = 1.5 + pt.intensity * 3.5;
      const alpha = 0.3 + pt.intensity * 0.7;

      // Glow
      const glow = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r * 3);
      glow.addColorStop(0, `rgba(196,150,58,${alpha * 0.4})`);
      glow.addColorStop(1, "rgba(196,150,58,0)");
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r * 3, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Star core
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(232,201,122,${alpha})`;
      ctx.fill();
    }

    // Pulse ring on most recent active point
    const lastActive = [...points].reverse().find((p) => p.intensity > 0);
    if (lastActive) {
      ctx.beginPath();
      ctx.arc(lastActive.x, lastActive.y, 8, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(196,150,58,0.25)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [data, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "100%" }}
      aria-label="Activity constellation map"
    />
  );
}
