'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface GoalCompletionModalProps {
  isOpen: boolean
  goalName: string
  daysToComplete: number
  totalCheckins: number
  completionRate: number
  category: string
  onClose: () => void
  onViewStats?: () => void
  onSetNextGoal?: () => void
}

// Particle positions: top-left, top-right, bottom-left, bottom-right
const PARTICLES: { dx: number; dy: number; color: string; r: number }[] = [
  { dx: -25, dy: -25, color: '#C4BFFA', r: 3 },
  { dx: 25, dy: -25, color: '#7F77DD', r: 2.5 },
  { dx: -25, dy: 25, color: '#7F77DD', r: 2 },
  { dx: 25, dy: 25, color: '#C4BFFA', r: 3 },
]

function TrophySVG() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background circle */}
      <circle cx="40" cy="40" r="38" fill="#EEEDFE" stroke="#534AB7" strokeWidth="1.5" />

      {/* Particles */}
      {PARTICLES.map((p, i) => (
        <motion.circle
          key={i}
          cx={40 + p.dx}
          cy={40 + p.dy}
          r={p.r}
          fill={p.color}
          initial={{ scale: 0, x: 0, y: 0 }}
          animate={{
            scale: 1,
            x: p.dx * 0.4,
            y: p.dy * 0.4,
          }}
          transition={{ delay: i * 0.08, duration: 0.4, ease: 'easeOut' }}
        />
      ))}

      {/* Checkmark */}
      <motion.path
        d="M20,40 L33,53 L60,26"
        stroke="#534AB7"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
      />
    </svg>
  )
}

export default function GoalCompletionModal({
  isOpen,
  goalName,
  daysToComplete,
  totalCheckins,
  completionRate,
  onClose,
  onViewStats,
  onSetNextGoal,
}: GoalCompletionModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="completion-backdrop"
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
              key="completion-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Goal completed"
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
                {/* Trophy SVG */}
                <div className="flex justify-center mb-4">
                  <TrophySVG />
                </div>

                {/* "Goal completed" heading */}
                <div
                  className="text-center mb-1"
                  style={{ fontSize: 18, fontWeight: 500, color: '#111827' }}
                >
                  Goal completed
                </div>

                {/* Goal name italic */}
                <div
                  className="text-center mb-1"
                  style={{ fontSize: 13, color: '#6B7280', fontStyle: 'italic' }}
                >
                  {goalName}
                </div>

                {/* Days + check-ins summary */}
                <div
                  className="text-center mb-4"
                  style={{ fontSize: 12, color: '#9CA3AF' }}
                >
                  Completed in {daysToComplete} days · {totalCheckins} check-ins
                </div>

                {/* Stats 2-up grid */}
                <div className="grid grid-cols-2 gap-3 my-4">
                  {/* Check-ins card */}
                  <div
                    className="rounded-xl p-3 text-center"
                    style={{ backgroundColor: '#EEEDFE' }}
                  >
                    <div
                      style={{ fontSize: 24, fontWeight: 500, color: '#534AB7', lineHeight: 1.1 }}
                    >
                      {totalCheckins}
                    </div>
                    <div
                      style={{ fontSize: 11, color: '#7F77DD', marginTop: 2 }}
                    >
                      check-ins
                    </div>
                  </div>

                  {/* Completion rate card */}
                  <div
                    className="rounded-xl p-3 text-center"
                    style={{ backgroundColor: '#EEEDFE' }}
                  >
                    <div
                      style={{ fontSize: 24, fontWeight: 500, color: '#534AB7', lineHeight: 1.1 }}
                    >
                      {completionRate}%
                    </div>
                    <div
                      style={{ fontSize: 11, color: '#7F77DD', marginTop: 2 }}
                    >
                      completion rate
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex flex-col gap-2">
                  {/* View stats — ghost */}
                  <button
                    type="button"
                    onClick={() => { onViewStats?.(); }}
                    className="min-h-[44px] w-full rounded-[10px] font-medium text-sm border border-gray-200 text-gray-700 flex items-center justify-center"
                  >
                    View stats
                  </button>

                  {/* Set next goal — purple primary */}
                  <button
                    type="button"
                    onClick={() => { onSetNextGoal?.(); onClose(); }}
                    className="min-h-[44px] w-full rounded-[10px] font-medium text-sm text-white flex items-center justify-center"
                    style={{ backgroundColor: '#7F77DD' }}
                  >
                    Set next goal →
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
