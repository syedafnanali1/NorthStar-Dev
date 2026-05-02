'use client'

import { format } from 'date-fns'

interface PredictionCardProps {
  goalTitle: string
  targetDate: string
  predictedDate: string
  daysAheadOrBehind: number
  confidence: 'high' | 'medium' | 'low'
  currentProgress: number
  projectedWith2xCheckins?: string
  className?: string
}

const CONFIDENCE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high:   { bg: '#E1F5EE', text: '#0F6E56', label: 'High confidence' },
  medium: { bg: '#FAEEDA', text: '#BA7517', label: 'Moderate' },
  low:    { bg: '#FAECE7', text: '#993C1D', label: 'Low confidence' },
}

function formatDate(iso: string): string {
  try {
    return format(new Date(iso), 'MMM d, yyyy')
  } catch {
    return iso
  }
}

export default function PredictionCard({
  goalTitle,
  targetDate,
  predictedDate,
  daysAheadOrBehind,
  confidence,
  currentProgress,
  projectedWith2xCheckins,
  className,
}: PredictionCardProps) {
  const isAhead = daysAheadOrBehind >= 0
  const accentColor = isAhead ? '#1D9E75' : '#D85A30'
  const deltaText = isAhead
    ? `${daysAheadOrBehind} day${daysAheadOrBehind !== 1 ? 's' : ''} ahead of schedule`
    : `${Math.abs(daysAheadOrBehind)} day${Math.abs(daysAheadOrBehind) !== 1 ? 's' : ''} behind schedule`

  const confidenceStyle = CONFIDENCE_STYLES[confidence] ?? CONFIDENCE_STYLES.low!

  // Calculate planned progress for a straight-line projection
  const now = Date.now()
  const start = new Date(targetDate).getTime() - 90 * 24 * 60 * 60 * 1000 // approximate 90-day goal
  const totalSpan = new Date(targetDate).getTime() - start
  const elapsed = now - start
  const plannedProgress = totalSpan > 0 ? Math.min(100, Math.max(0, (elapsed / totalSpan) * 100)) : 50

  return (
    <div
      className={`rounded-2xl border bg-white overflow-hidden ${className ?? ''}`}
      style={{ borderColor: 'rgb(var(--cream-dark-rgb))', borderLeftWidth: 4, borderLeftColor: accentColor }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="uppercase tracking-wide text-ink-muted" style={{ fontSize: 11 }}>
            Completion forecast
          </span>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 font-medium flex-shrink-0"
            style={{ backgroundColor: confidenceStyle.bg, color: confidenceStyle.text, fontSize: 11 }}
          >
            {confidenceStyle.label}
          </span>
        </div>

        {/* Goal title */}
        <p className="font-medium text-ink truncate mb-1" style={{ fontSize: 14 }}>{goalTitle}</p>

        {/* Main statement */}
        <p className="text-ink-soft mb-1" style={{ fontSize: 15 }}>
          At current pace, this completes{' '}
          <span className="font-semibold text-ink">{formatDate(predictedDate)}</span>
        </p>

        {/* Ahead/behind label */}
        <p className="font-semibold mb-4" style={{ fontSize: 13, color: accentColor }}>
          {deltaText}
        </p>

        {/* Progress bars */}
        <div className="space-y-2 mb-4">
          {/* Planned progress */}
          <div>
            <div className="flex justify-between mb-0.5">
              <span className="text-ink-muted" style={{ fontSize: 11 }}>Planned</span>
              <span className="text-ink-muted font-medium" style={{ fontSize: 11 }}>{Math.round(plannedProgress)}%</span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 6, backgroundColor: 'rgb(var(--cream-dark-rgb))' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${plannedProgress}%`, backgroundColor: 'rgb(var(--cream-dark-rgb))' }}
              />
            </div>
          </div>

          {/* Actual progress */}
          <div>
            <div className="flex justify-between mb-0.5">
              <span className="text-ink-muted" style={{ fontSize: 11 }}>Actual</span>
              <span className="font-medium" style={{ fontSize: 11, color: accentColor }}>{Math.round(currentProgress)}%</span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 6, backgroundColor: 'rgb(var(--cream-dark-rgb))' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${currentProgress}%`, backgroundColor: accentColor }}
              />
            </div>
          </div>
        </div>

        {/* 2x check-in advisory */}
        {projectedWith2xCheckins && (
          <div className="rounded-xl p-3" style={{ backgroundColor: '#E1F5EE' }}>
            <p style={{ fontSize: 13, color: '#0F6E56' }}>
              Check in 2× more per week → finish by{' '}
              <span className="font-semibold">{formatDate(projectedWith2xCheckins)}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
