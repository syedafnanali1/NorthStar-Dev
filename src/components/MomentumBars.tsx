'use client'

import { motion } from 'framer-motion'

interface Goal {
  id: string
  title: string
  emoji?: string
  checkInRate7d: number
  atRiskFlag: boolean
  daysAheadOrBehind?: number
}

interface MomentumBarsProps {
  goals: Goal[]
  className?: string
}

function statusLabel(rate: number): string {
  if (rate >= 0.7) return 'On track'
  if (rate >= 0.4) return 'At risk'
  return 'Behind'
}

function barColor(rate: number): string {
  if (rate >= 0.7) return '#1D9E75'
  if (rate >= 0.4) return '#EF9F27'
  return '#D85A30'
}

function labelColor(rate: number): string {
  if (rate >= 0.7) return '#085041'
  if (rate >= 0.4) return '#633806'
  return '#712B13'
}

export default function MomentumBars({ goals, className }: MomentumBarsProps) {
  if (!goals || goals.length === 0) {
    return (
      <div className={`flex items-center justify-center py-6 text-ink-muted ${className ?? ''}`} style={{ fontSize: 13 }}>
        No active goals
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      {goals.map((goal) => {
        const rate = Math.max(0, Math.min(1, goal.checkInRate7d))
        const color = barColor(rate)
        const textColor = labelColor(rate)
        const pct = rate * 100

        return (
          <div key={goal.id} className="flex items-center gap-3">
            {/* Emoji + title */}
            <div className="flex items-center gap-1.5 min-w-0" style={{ width: 148 }}>
              {goal.emoji && <span style={{ fontSize: 14 }} aria-hidden>{goal.emoji}</span>}
              <span
                className="truncate text-ink font-medium"
                style={{ fontSize: 13 }}
                title={goal.title}
              >
                {goal.title}
              </span>
            </div>

            {/* Progress bar */}
            <div
              className="flex-1 rounded-full overflow-hidden"
              style={{ height: 6, backgroundColor: 'rgb(var(--cream-dark-rgb))' }}
              role="progressbar"
              aria-valuenow={Math.round(pct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${goal.title}: ${Math.round(pct)}% check-in rate`}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
                initial={{ width: '0%' }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>

            {/* Status label */}
            <span
              className="flex-shrink-0 font-medium"
              style={{ fontSize: 11, color: textColor, width: 52, textAlign: 'right' }}
            >
              {statusLabel(rate)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
