'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface AtRiskNudgeModalProps {
  isOpen: boolean
  goalName: string
  daysMissed: number
  daysLate: number
  suggestions: string[]
  onClose: () => void
  onCheckIn?: () => void
  onAdjustDeadline?: () => void
}

function WarningSVG() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background circle */}
      <circle cx="32" cy="32" r="30" fill="#FAECE7" stroke="#D85A30" strokeWidth="1.5" />
      {/* Exclamation bar */}
      <line
        x1="32"
        y1="14"
        x2="32"
        y2="36"
        stroke="#D85A30"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Exclamation dot */}
      <circle cx="32" cy="44" r="2.5" fill="#D85A30" />
    </svg>
  )
}

export default function AtRiskNudgeModal({
  isOpen,
  goalName,
  daysMissed,
  daysLate,
  suggestions,
  onClose,
  onCheckIn,
  onAdjustDeadline,
}: AtRiskNudgeModalProps) {
  // Clamp suggestions to max 3
  const clampedSuggestions = suggestions.slice(0, 3)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="atrisk-backdrop"
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
              key="atrisk-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={`${goalName} needs attention`}
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
                {/* Warning SVG */}
                <div className="flex justify-center mb-4">
                  <WarningSVG />
                </div>

                {/* Heading */}
                <div
                  className="text-center mb-1"
                  style={{ fontSize: 18, fontWeight: 500, color: '#111827' }}
                >
                  &ldquo;{goalName}&rdquo; needs attention
                </div>

                {/* Stats subtitle */}
                <div
                  className="text-center mb-4"
                  style={{ fontSize: 13, color: '#6B7280' }}
                >
                  {daysMissed} days without a check-in · {daysLate} days behind
                </div>

                {/* Suggestions box */}
                {clampedSuggestions.length > 0 && (
                  <div
                    className="rounded-xl p-3 mb-4"
                    style={{ backgroundColor: '#FAECE7' }}
                  >
                    {clampedSuggestions.map((suggestion, i) => (
                      <div
                        key={i}
                        style={{
                          fontSize: 12,
                          color: '#712B13',
                          lineHeight: 1.6,
                          marginBottom: i < clampedSuggestions.length - 1 ? 4 : 0,
                        }}
                      >
                        — {suggestion}
                      </div>
                    ))}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex flex-col gap-2">
                  {/* Adjust deadline — ghost */}
                  <button
                    type="button"
                    onClick={() => { onAdjustDeadline?.(); }}
                    className="min-h-[44px] w-full rounded-[10px] font-medium text-sm border border-gray-200 text-gray-700 flex items-center justify-center"
                  >
                    Adjust deadline
                  </button>

                  {/* Check in now — coral primary */}
                  <button
                    type="button"
                    onClick={() => { onCheckIn?.(); onClose(); }}
                    className="min-h-[44px] w-full rounded-[10px] font-medium text-sm text-white flex items-center justify-center"
                    style={{ backgroundColor: '#D85A30' }}
                  >
                    Check in now
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
