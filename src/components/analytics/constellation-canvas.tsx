// src/components/analytics/constellation-canvas.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { ConstellationPoint } from "@/server/services/analytics.service";

// ADDITION H: category-based dot colors
const CATEGORY_COLORS: Record<string, string> = {
  health: "#6B8C7A",
  finance: "#5B7EA6",
  writing: "#C4963A",
  body: "#B5705B",
  mindset: "#7B6FA0",
  custom: "#C4963A",
};

interface ConstellationCanvasProps {
  data: ConstellationPoint[];
  width?: number;
  height?: number;
}

export function ConstellationCanvas({
  data,
  width = 320,
  height = 190,
}: ConstellationCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width, height });

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const updateSize = () => {
      const nextWidth = Math.max(wrapper.clientWidth, 220);
      const ratio = height / width;
      setSize({
        width: nextWidth,
        height: Math.max(wrapper.clientHeight, Math.round(nextWidth * ratio)),
      });
    };

    updateSize();

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [height, width]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width: canvasWidth, height: canvasHeight } = size;

    // HiDPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (data.length === 0) return;

    // Map dates to x positions, intensity to y + brightness
    const padding = 16;
    const plotW = canvasWidth - padding * 2;
    const plotH = canvasHeight - padding * 2;

    // Assign star positions: x = time, y = inverted intensity (active = high)
    const points = data.map((d, i) => ({
      x: padding + (i / Math.max(data.length - 1, 1)) * plotW,
      y: padding + plotH - d.intensity * plotH * 0.85 - (((i * 7 + 3) % 12)),
      intensity: d.intensity,
      date: d.date,
      color: d.category ? (CATEGORY_COLORS[d.category] ?? "#C4963A") : "#C4963A",
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
      const starColor = pt.color;

      // Parse the hex color to rgba for glow
      const hex = starColor.replace("#", "");
      const rC = parseInt(hex.substring(0, 2), 16);
      const gC = parseInt(hex.substring(2, 4), 16);
      const bC = parseInt(hex.substring(4, 6), 16);

      // Glow
      const glow = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r * 3);
      glow.addColorStop(0, `rgba(${rC},${gC},${bC},${alpha * 0.4})`);
      glow.addColorStop(1, `rgba(${rC},${gC},${bC},0)`);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r * 3, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Star core
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rC},${gC},${bC},${alpha})`;
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
  }, [data, size]);

  return (
    <div ref={wrapperRef} className="h-full w-full">
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
        aria-label="Activity constellation map"
      />
    </div>
  );
}
