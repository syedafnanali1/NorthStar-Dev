'use client'

import { useEffect, useState } from 'react'
import type { Variants, Transition } from 'framer-motion'

// ─── Transition objects ───────────────────────────────────────────────────────

export const springEntry: Transition = {
  type: 'spring',
  damping: 22,
  stiffness: 160,
}

export const springToast: Transition = {
  type: 'spring',
  damping: 20,
  stiffness: 180,
}

export const timingFast: Transition = {
  duration: 0.25,
  ease: 'easeOut',
}

export const timingMedium: Transition = {
  duration: 0.3,
  ease: 'easeOut',
}

export const timingSlow: Transition = {
  duration: 0.6,
  ease: 'easeOut',
}

// ─── Framer Motion variants ───────────────────────────────────────────────────

/** Bottom sheet slides up from y=300. */
export const sheetEntryVariants: Variants = {
  hidden: { y: 300, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: springEntry,
  },
  exit: {
    y: 300,
    opacity: 0,
    transition: { duration: 0.28, ease: 'easeIn' },
  },
}

/** Alias for the exit state of a bottom sheet. */
export const sheetExitVariants: Variants = {
  exit: {
    y: 300,
    opacity: 0,
    transition: { duration: 0.28, ease: 'easeIn' },
  },
}

/** Top toast slides down from y=-60. */
export const toastEntryVariants: Variants = {
  hidden: { y: -80, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: springToast,
  },
  exit: {
    y: -80,
    opacity: 0,
    transition: { duration: 0.25 },
  },
}

export const toastExitVariants: Variants = {
  exit: {
    y: -80,
    opacity: 0,
    transition: { duration: 0.25 },
  },
}

export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: timingMedium,
  },
  exit: {
    opacity: 0,
    transition: timingFast,
  },
}

export const scaleInVariants: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', damping: 18, stiffness: 200 },
  },
  exit: {
    scale: 0,
    opacity: 0,
    transition: timingFast,
  },
}

export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
}

/** Stagger container — children animate in sequence. */
export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
    },
  },
}

/** Single stagger child item. */
export const staggerItemVariants: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', damping: 18, stiffness: 220 },
  },
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Animates a number from 0 to `target` over `duration` ms using requestAnimationFrame.
 * Returns the current animated value (integer).
 */
export function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (target === 0) {
      setValue(0)
      return
    }

    let startTime: number | null = null
    let rafId: number

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) {
        rafId = requestAnimationFrame(step)
      }
    }

    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [target, duration])

  return value
}

/**
 * Returns SVG stroke-dashoffset animation config for a path-drawing effect.
 * Use with `strokeDasharray={length}` and animate `strokeDashoffset` from `length` to `0`.
 */
export function drawPath(length: number, duration = 600) {
  return {
    strokeDasharray: length,
    initial: { strokeDashoffset: length },
    animate: { strokeDashoffset: 0 },
    transition: { duration: duration / 1000, ease: 'easeOut' },
  }
}

/**
 * Returns Framer Motion props for a celebration particle that scatters outward.
 * @param angle - direction in degrees (0 = right, 90 = down, etc.)
 * @param distance - how far to travel in pixels
 */
export function scatterParticle(angle: number, distance: number) {
  const rad = (angle * Math.PI) / 180
  const x = Math.cos(rad) * distance
  const y = Math.sin(rad) * distance
  return {
    initial: { scale: 0, opacity: 0, x: 0, y: 0 },
    animate: { scale: 1, opacity: 1, x, y },
    exit: { scale: 0, opacity: 0 },
    transition: { type: 'spring', damping: 14, stiffness: 160 },
  }
}
