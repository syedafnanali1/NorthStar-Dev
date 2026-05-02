'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface GlanceData {
  activeGoals: number
  weeklyStreak: number
  completionRate: number
  momentumScore?: number
  activeGoalsDelta: number
  streakDelta: number
  completionRateDelta: number
}

function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (target === 0) { setValue(0); return }
    let start: number | null = null
    let raf: number
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

function TrendUp() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <polyline points="1,9 5,4 8,7 11,2" stroke="#1D9E75" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrendDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <polyline points="1,3 5,8 8,5 11,10" stroke="#D85A30" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface MetricCardProps {
  label: string
  value: number
  suffix?: string
  delta: number
}

function MetricCard({ label, value, suffix, delta }: MetricCardProps) {
  const animated = useCountUp(value)
  return (
    <Link
      href="/analytics"
      className="flex-1 rounded-xl border border-cream-dark bg-white p-3 shadow-sm flex flex-col gap-1 min-w-0 hover:shadow-md transition-shadow"
      aria-label={`${label}: ${value}${suffix ?? ''}. Navigate to analytics.`}
    >
      <span className="text-ink-muted uppercase tracking-wide truncate" style={{ fontSize: 11 }}>
        {label}
      </span>
      <span className="font-bold text-ink" style={{ fontSize: 22, lineHeight: 1.1 }}>
        {animated}{suffix}
      </span>
      <span className="flex items-center gap-0.5" style={{ fontSize: 11 }}>
        {delta > 0 && (
          <>
            <TrendUp />
            <span style={{ color: '#1D9E75' }}>+{delta}</span>
          </>
        )}
        {delta < 0 && (
          <>
            <TrendDown />
            <span style={{ color: '#D85A30' }}>{delta}</span>
          </>
        )}
        {delta === 0 && <span className="text-ink-muted">—</span>}
      </span>
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div className="flex-1 rounded-xl border border-cream-dark bg-white p-3 animate-pulse" aria-hidden>
      <div className="h-2.5 w-16 rounded bg-cream-dark mb-2" />
      <div className="h-6 w-10 rounded bg-cream-dark mb-1.5" />
      <div className="h-2.5 w-8 rounded bg-cream-dark" />
    </div>
  )
}

export default function GlanceBar() {
  const [data, setData] = useState<GlanceData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics/glance')
      .then((r) => r.ok ? r.json() : null)
      .then((d: GlanceData | null) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex gap-2" aria-busy="true" aria-label="Loading stats">
        {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex gap-2">
        {['Active Goals', 'Streak', 'Completion', 'Momentum'].map((label) => (
          <Link
            key={label}
            href="/analytics"
            className="flex-1 rounded-xl border border-cream-dark bg-white p-3 flex flex-col gap-1"
          >
            <span className="text-ink-muted uppercase tracking-wide" style={{ fontSize: 11 }}>{label}</span>
            <span className="font-bold text-ink" style={{ fontSize: 22 }}>—</span>
          </Link>
        ))}
      </div>
    )
  }

  const momentum = data.momentumScore ?? Math.round(data.completionRate)

  return (
    <div className="flex gap-2">
      <MetricCard label="Active Goals" value={data.activeGoals} delta={data.activeGoalsDelta} />
      <MetricCard label="Streak" value={data.weeklyStreak} suffix="d" delta={data.streakDelta} />
      <MetricCard label="Completion" value={data.completionRate} suffix="%" delta={data.completionRateDelta} />
      <MetricCard label="Momentum" value={momentum} delta={0} />
    </div>
  )
}
