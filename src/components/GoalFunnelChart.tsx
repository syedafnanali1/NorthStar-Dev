'use client'

import { motion } from 'framer-motion'

interface FunnelStage {
  label: string
  count: number
  pct: number
}

interface GoalFunnelChartProps {
  stages?: FunnelStage[]
  className?: string
}

const DEFAULT_STAGES: FunnelStage[] = [
  { label: 'Created', count: 24, pct: 100 },
  { label: 'First check-in', count: 18, pct: 75 },
  { label: '50% done', count: 10, pct: 42 },
  { label: 'Completed', count: 5, pct: 21 },
]

function DropOffArrow({ pct, isBiggest }: { pct: number; isBiggest: boolean }) {
  const color = isBiggest ? '#D85A30' : '#8C857D'
  return (
    <div className="flex flex-col items-center py-1 gap-0.5">
      <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden>
        <path d="M8 0 L8 8 M5 5 L8 8 L11 5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ fontSize: 11, color, fontWeight: isBiggest ? 600 : 400 }}>
        −{pct}% dropped off
      </span>
      {isBiggest && (
        <span className="text-center" style={{ fontSize: 10, color: '#D85A30', maxWidth: 160 }}>
          Most goals drop off here — add a reminder on day 1
        </span>
      )}
    </div>
  )
}

export default function GoalFunnelChart({ stages, className }: GoalFunnelChartProps) {
  const data = stages && stages.length > 0 ? stages : DEFAULT_STAGES
  const isEmpty = !stages || stages.length === 0

  // Find the biggest drop-off index
  let biggestDropIndex = 0
  let biggestDrop = 0
  for (let i = 1; i < data.length; i++) {
    const drop = (data[i - 1]!.pct - data[i]!.pct)
    if (drop > biggestDrop) {
      biggestDrop = drop
      biggestDropIndex = i
    }
  }

  return (
    <div className={className} style={{ opacity: isEmpty ? 0.5 : 1 }}>
      {isEmpty && (
        <p className="text-center text-ink-muted mb-3" style={{ fontSize: 12 }}>
          Sample data shown — create goals to see your real funnel
        </p>
      )}

      <div className="flex flex-col items-center gap-0">
        {data.map((stage, i) => {
          const isBiggestDrop = i === biggestDropIndex
          const barWidth = `${Math.max(stage.pct, 20)}%`
          const barColor = isBiggestDrop ? '#D85A30' : '#1D9E75'
          const dropFromPrev = i > 0 ? data[i - 1]!.pct - stage.pct : 0

          return (
            <div key={stage.label} className="flex flex-col items-center w-full">
              {/* Drop-off arrow between stages */}
              {i > 0 && (
                <DropOffArrow
                  pct={Math.round(dropFromPrev)}
                  isBiggest={i === biggestDropIndex}
                />
              )}

              {/* Stage bar */}
              <div className="flex flex-col items-center" style={{ width: '100%' }}>
                <span className="font-medium text-ink mb-1" style={{ fontSize: 13 }}>
                  {stage.label}
                </span>
                <div className="flex justify-center w-full">
                  <motion.div
                    className="flex items-center justify-center rounded-lg"
                    style={{ height: 44, backgroundColor: barColor, maxWidth: 400 }}
                    initial={{ width: '0%' }}
                    animate={{ width: barWidth }}
                    transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.1 }}
                  >
                    <span className="font-semibold text-white" style={{ fontSize: 13 }}>
                      {stage.count} goals
                    </span>
                  </motion.div>
                </div>
                <span className="text-ink-muted mt-0.5" style={{ fontSize: 11 }}>
                  {stage.pct}% of total
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-ink-muted text-center" style={{ fontSize: 12 }}>
        {biggestDrop > 0
          ? `${Math.round(biggestDrop)}% of goals stall at the "${data[biggestDropIndex]!.label}" stage.`
          : 'Great funnel consistency across all stages.'}
      </p>
    </div>
  )
}
