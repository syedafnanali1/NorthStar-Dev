'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type BadgeType = 'best_week' | 'improving' | 'steady' | null

interface WeeklyInsightsModalProps {
  isOpen: boolean
  weekLabel: string
  checkinsCount: number
  checkinsDelta: number
  completionRate: number
  completionDelta: number
  bestGoal: string
  worstGoal: string
  peakDay: string
  badge: BadgeType
  insights: string[]
  onClose: () => void
  onViewAnalytics?: () => void
}

function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = React.useState(0)
  React.useEffect(() => {
    setValue(0)
    let start: number | null = null
    const id = requestAnimationFrame(function step(ts) {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      setValue(Math.round(target * p))
      if (p < 1) requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(id)
  }, [target, duration])
  return value
}

interface BadgeConfig {
  bg: string
  text: string
  label: string
}

const BADGE_MAP: Record<NonNullable<BadgeType>, BadgeConfig> = {
  best_week: { bg: '#E1F5EE', text: '#0B5E41', label: 'Best week yet' },
  improving: { bg: '#E6F1FB', text: '#185FA5', label: 'Improving' },
  steady: { bg: '#F9FAFB', text: '#4B5563', label: 'Steady' },
}

function DeltaArrow({ value }: { value: number }) {
  if (value === 0) return null
  const isUp = value > 0
  const color = isUp ? '#1D9E75' : '#D85A30'

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 4 }}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
        {isUp ? (
          // Up arrow
          <path d="M5 1 L9 7 H1 Z" fill={color} />
        ) : (
          // Down arrow
          <path d="M5 9 L9 3 H1 Z" fill={color} />
        )}
      </svg>
      <span style={{ fontSize: 11, color, marginLeft: 2, fontWeight: 500 }}>
        {Math.abs(value)}
      </span>
    </span>
  )
}

export default function WeeklyInsightsModal({
  isOpen,
  weekLabel,
  checkinsCount,
  checkinsDelta,
  completionRate,
  completionDelta,
  bestGoal,
  worstGoal,
  peakDay,
  badge,
  insights,
  onClose,
  onViewAnalytics,
}: WeeklyInsightsModalProps) {
  const animatedCheckins = useCountUp(isOpen ? checkinsCount : 0, 800)
  const animatedRate = useCountUp(isOpen ? completionRate : 0, 800)

  const badgeConfig = badge ? BADGE_MAP[badge] : null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="weekly-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
            <motion.div
              key="weekly-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={`Weekly insights: ${weekLabel}`}
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 160 }}
              className="relative bg-white rounded-t-[20px] rounded-b-[16px] pointer-events-auto w-full pb-6"
              style={{ maxWidth: 'min(calc(100vw - 32px), 400px)' }}
            >
              {/* Handle bar */}
              <div
                className="w-9 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-4 cursor-pointer"
                onClick={onClose}
                role="button"
                aria-label="Close"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onClose()}
              />

              <div className="px-5">
                {/* Header: week label + optional badge */}
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="uppercase"
                    style={{ fontSize: 11, color: '#9CA3AF', letterSpacing: '0.05em' }}
                  >
                    {weekLabel}
                  </span>
                  {badgeConfig && (
                    <span
                      className="px-3 py-1 rounded-full"
                      style={{
                        backgroundColor: badgeConfig.bg,
                        color: badgeConfig.text,
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {badgeConfig.label}
                    </span>
                  )}
                </div>

                {/* Stats 2-up grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Check-ins card */}
                  <div className="rounded-xl p-3 bg-gray-50 text-center">
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 500,
                        color: '#111827',
                        lineHeight: 1.1,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      {animatedCheckins}
                      <DeltaArrow value={checkinsDelta} />
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
                      check-ins this week
                    </div>
                  </div>

                  {/* Completion rate card */}
                  <div className="rounded-xl p-3 bg-gray-50 text-center">
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 500,
                        color: '#111827',
                        lineHeight: 1.1,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      {animatedRate}%
                      <DeltaArrow value={completionDelta} />
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
                      completion rate
                    </div>
                  </div>
                </div>

                {/* Highlights row */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 mb-4">
                  <span style={{ fontSize: 12, color: '#0B5E41' }}>
                    Best: {bestGoal}
                  </span>
                  <span style={{ fontSize: 12, color: '#993C1D' }}>
                    Worst: {worstGoal}
                  </span>
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                    Peak: {peakDay}
                  </span>
                </div>

                {/* Insights section */}
                {insights.length > 0 && (
                  <div
                    className="rounded-xl p-3 mb-4"
                    style={{ backgroundColor: '#E1F5EE' }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: '#085041',
                        marginBottom: 8,
                      }}
                    >
                      This week&apos;s insights
                    </div>
                    {insights.map((insight, i) => (
                      <div
                        key={i}
                        style={{
                          fontSize: 13,
                          color: '#085041',
                          lineHeight: 1.6,
                          marginBottom: i < insights.length - 1 ? 2 : 0,
                        }}
                      >
                        — {insight}
                      </div>
                    ))}
                  </div>
                )}

                {/* See full analytics button — teal primary */}
                <button
                  type="button"
                  onClick={() => { onViewAnalytics?.(); onClose(); }}
                  className="min-h-[44px] w-full rounded-[10px] font-medium text-sm text-white flex items-center justify-center"
                  style={{ backgroundColor: '#1D9E75' }}
                >
                  See full analytics →
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
