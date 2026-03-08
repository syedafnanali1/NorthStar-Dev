// src/lib/utils/index.ts
// Shared utility functions

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, parseISO, isToday, isYesterday } from "date-fns";

/**
 * Merge Tailwind classes safely
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a number with compact notation (1.2K, 3.4M)
 */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/**
 * Format a date for display
 */
export function formatDate(date: Date | string, fmt = "MMM d, yyyy"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, fmt);
}

/**
 * Relative time with "today/yesterday" handling
 */
export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  if (isToday(d)) return "today";
  if (isYesterday(d)) return "yesterday";
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Get goal color from category
 */
export function categoryColor(category: string): string {
  const colors: Record<string, string> = {
    health: "#6B8C7A",
    finance: "#5B7EA6",
    writing: "#C4963A",
    body: "#B5705B",
    mindset: "#7B6FA0",
    custom: "#C4963A",
  };
  return colors[category] ?? "#C4963A";
}

/**
 * Get emoji from category
 */
export function categoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    health: "🏃",
    finance: "💰",
    writing: "✍️",
    body: "⚖️",
    mindset: "🧠",
    custom: "⭐",
  };
  return emojis[category] ?? "⭐";
}

/**
 * Compute SVG circle progress ring dashoffset
 * r=36, circumference = 2π×36 ≈ 226.2
 */
export function ringOffset(percent: number, radius = 36): number {
  const circumference = 2 * Math.PI * radius;
  return circumference - (percent / 100) * circumference;
}

/**
 * Generate initials from name
 */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Parse API error to user-friendly message
 */
export function parseApiError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Something went wrong. Please try again.";
}

/**
 * Delay for animations
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Format unit display (e.g., "km", "words", "$")
 */
export function formatUnit(value: number, unit: string | null | undefined): string {
  if (!unit) return value.toString();
  if (unit === "$") return `$${formatCompact(value)}`;
  return `${formatCompact(value)} ${unit}`;
}
