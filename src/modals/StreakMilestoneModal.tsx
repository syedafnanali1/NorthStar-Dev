'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface StreakMilestoneModalProps {
  isOpen: boolean
  streakCount: number
  goalName: string
  isPersonalBest: boolean
  percentile: number
  onClose: () => void
  onShare?: () => void
}

function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = React.useState(0)
  React.useEffect(() => {
    setValue(0)
    let start: number | null = null
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      setValue(Math.round(target * p))
      if (p < 1) requestAnimationFrame(step)
    }
    const id = requestAnimationFrame(step)
    return () => cancelAnimationFrame(id)
  }, [target, duration])
  return value
}

const CONFETTI_COLORS = [
  '#1D9E75',
  '#7F77DD',
  '#D85A30',
  '#EF9F27',
  '#EC4899',
  '#1D9E75',
  '#7F77DD',
]

export default function StreakMilestoneModal({
  isOpen,
  streakCount,
  goalName,
  isPersonalBest,
  percentile,
  onClose,
  onShare,
}: StreakMilestoneModalProps) {
  const count = useCountUp(isOpen ? streakCount : 0, 800)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="streak-backdrop"
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
              key="streak-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={`Streak milestone: ${streakCount} days`}
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
                {/* Confetti dots */}
                <div className="flex justify-center gap-2 mb-3">
                  {CONFETTI_COLORS.map((color, i) => (
                    <motion.svg
                      key={i}
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: i * 0.06, type: 'spring', damping: 14, stiffness: 200 }}
                    >
                      <circle cx="7" cy="7" r="7" fill={color} />
                    </motion.svg>
                  ))}
                </div>

                {/* Flame SVG */}
                <div className="flex justify-center mb-3">
                  <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Outer circle */}
                    <circle cx="36" cy="36" r="34" fill="#EEEDFE" stroke="#7F77DD" strokeWidth="1.5" />
                    {/* Outer flame */}
                    <path
                      d="M36,8 C46,18 58,28 58,44 C58,57 48,68 36,68 C24,68 14,57 14,44 C14,28 26,18 36,8 Z"
                      fill="#E1F5EE"
                      stroke="#1D9E75"
                      strokeWidth="1"
                      opacity="0.3"
                    />
                    {/* Middle flame */}
                    <path
                      d="M36,16 C44,24 52,32 52,44 C52,54 45,63 36,63 C27,63 20,54 20,44 C20,32 28,24 36,16 Z"
                      fill="#1D9E75"
                      opacity="0.5"
                    />
                    {/* Inner flame */}
                    <path
                      d="M36,24 C42,30 46,36 46,44 C46,51 42,58 36,58 C30,58 26,51 26,44 C26,36 30,30 36,24 Z"
                      fill="#0F6E56"
                      opacity="1"
                    />
                  </svg>
                </div>

                {/* Streak count */}
                <div
                  className="text-center"
                  style={{ fontSize: 42, fontWeight: 500, color: '#111827', lineHeight: 1.1 }}
                >
                  {count}
                </div>

                {/* "day streak" label */}
                <div
                  className="text-center mb-2"
                  style={{ fontSize: 13, color: '#6B7280' }}
                >
                  day streak
                </div>

                {/* Goal name / description */}
                <div
                  className="text-center mx-auto mb-4"
                  style={{
                    fontSize: 13,
                    color: '#9CA3AF',
                    maxWidth: 240,
                    lineHeight: 1.5,
                  }}
                >
                  You&apos;re building something real with &ldquo;{goalName}&rdquo;. Keep it alive tomorrow.
                </div>

                {/* Pills row */}
                {(isPersonalBest || percentile <= 25) && (
                  <div className="flex justify-center gap-2 mb-5 flex-wrap">
                    {isPersonalBest && (
                      <span
                        className="px-3 py-1 rounded-full"
                        style={{
                          backgroundColor: '#E1F5EE',
                          color: '#0B5E41',
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        Personal best
                      </span>
                    )}
                    {percentile <= 25 && (
                      <span
                        className="px-3 py-1 rounded-full"
                        style={{
                          backgroundColor: '#EEEDFE',
                          color: '#3C3489',
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        Top {percentile}% of users
                      </span>
                    )}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex flex-col gap-2">
                  {/* Share — ghost */}
                  <button
                    type="button"
                    onClick={onShare}
                    className="min-h-[44px] w-full rounded-[10px] font-medium text-sm border border-gray-200 text-gray-700 flex items-center justify-center"
                  >
                    Share
                  </button>
                  {/* Keep going — teal primary */}
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[44px] w-full rounded-[10px] font-medium text-sm text-white flex items-center justify-center"
                    style={{ backgroundColor: '#1D9E75' }}
                  >
                    Keep going →
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
