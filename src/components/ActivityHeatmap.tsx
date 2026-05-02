'use client'

import { useEffect, useState } from 'react'
import { format, subDays, startOfWeek, addDays, getDay } from 'date-fns'

interface ActivityHeatmapProps {
  activityGrid?: Record<string, number>
  className?: string
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

function intensityColor(count: number): string {
  if (count === 0) return '#EAECEF'
  if (count === 1) return '#9FE1CB'
  if (count <= 3) return '#56C5A0'
  if (count <= 5) return '#1D9E75'
  return '#085041'
}

function buildGrid(): string[] {
  const today = new Date()
  const days: string[] = []
  for (let i = 181; i >= 0; i--) {
    days.push(format(subDays(today, i), 'yyyy-MM-dd'))
  }
  return days
}

function buildWeeks(days: string[]): string[][] {
  const weeks: string[][] = []
  if (days.length === 0) return weeks

  const firstDay = new Date(days[0]!)
  const dayOfWeek = getDay(firstDay) // 0=Sun, 1=Mon...
  const paddingDays = dayOfWeek === 0 ? 0 : dayOfWeek

  const padded = [...Array.from({ length: paddingDays }, () => ''), ...days]
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7))
  }
  return weeks
}

export default function ActivityHeatmap({ activityGrid: externalGrid, className }: ActivityHeatmapProps) {
  const [grid, setGrid] = useState<Record<string, number> | null>(externalGrid ?? null)
  const [loading, setLoading] = useState(!externalGrid)

  useEffect(() => {
    if (externalGrid) { setGrid(externalGrid); return }
    fetch('/api/analytics')
      .then((r) => r.ok ? r.json() : null)
      .then((d: { activityGrid?: Record<string, number> } | null) => {
        setGrid(d?.activityGrid ?? {})
        setLoading(false)
      })
      .catch(() => { setGrid({}); setLoading(false) })
  }, [externalGrid])

  const allDays = buildGrid()
  const weeks = buildWeeks(allDays)

  // Caption data
  const nonZeroDays = allDays.filter((d) => (grid?.[d] ?? 0) > 0)
  const dayCountByWeekday: Record<number, number> = {}
  for (const d of nonZeroDays) {
    const dow = new Date(d).getDay()
    dayCountByWeekday[dow] = (dayCountByWeekday[dow] ?? 0) + 1
  }
  const sortedDows = Object.entries(dayCountByWeekday).sort((a, b) => Number(b[1]) - Number(a[1]))
  const busiest = sortedDows[0] ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][Number(sortedDows[0][0])] : '—'
  const quietest = sortedDows[sortedDows.length - 1] ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][Number(sortedDows[sortedDows.length - 1]![0])] : '—'

  // Month label positions
  const monthCols: { label: string; col: number }[] = []
  weeks.forEach((week, wi) => {
    const firstReal = week.find((d) => d !== '')
    if (firstReal) {
      const month = new Date(firstReal).getMonth()
      const prevWeek = wi > 0 ? weeks[wi - 1] : null
      const prevFirst = prevWeek?.find((d) => d !== '')
      const prevMonth = prevFirst ? new Date(prevFirst).getMonth() : -1
      if (month !== prevMonth) {
        monthCols.push({ label: MONTH_LABELS[month]!, col: wi })
      }
    }
  })

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <div style={{ minWidth: weeks.length * 12 + 24 }}>
          {/* Month labels */}
          <div className="flex mb-1" style={{ paddingLeft: 24 }}>
            {weeks.map((_, wi) => {
              const ml = monthCols.find((m) => m.col === wi)
              return (
                <div key={wi} style={{ width: 12, flexShrink: 0 }}>
                  {ml && (
                    <span className="text-ink-muted whitespace-nowrap" style={{ fontSize: 10 }}>
                      {ml.label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex gap-0.5">
            {/* Day-of-week labels */}
            <div className="flex flex-col gap-0.5 mr-1" style={{ width: 20 }}>
              {DAY_LABELS.map((label, i) => (
                <div key={i} className="text-ink-muted flex items-center" style={{ height: 10, fontSize: 9 }}>
                  {label}
                </div>
              ))}
            </div>

            {/* Grid */}
            {loading ? (
              Array.from({ length: 26 }, (_, wi) => (
                <div key={wi} className="flex flex-col gap-0.5">
                  {Array.from({ length: 7 }, (_, di) => (
                    <div
                      key={di}
                      className="rounded-sm animate-pulse bg-cream-dark"
                      style={{ width: 10, height: 10 }}
                    />
                  ))}
                </div>
              ))
            ) : (
              weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-0.5">
                  {week.map((dateStr, di) => {
                    if (!dateStr) {
                      return <div key={di} style={{ width: 10, height: 10 }} />
                    }
                    const count = grid?.[dateStr] ?? 0
                    return (
                      <div
                        key={di}
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          backgroundColor: intensityColor(count),
                          cursor: count > 0 ? 'pointer' : 'default',
                        }}
                        title={`${dateStr}: ${count} check-in${count !== 1 ? 's' : ''}`}
                        role={count > 0 ? 'img' : undefined}
                        aria-label={count > 0 ? `${dateStr}: ${count} check-ins` : undefined}
                      />
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-2">
        <span className="text-ink-muted" style={{ fontSize: 10 }}>Less</span>
        {['#EAECEF', '#9FE1CB', '#56C5A0', '#1D9E75', '#085041'].map((c) => (
          <div key={c} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c }} />
        ))}
        <span className="text-ink-muted" style={{ fontSize: 10 }}>More</span>
      </div>

      {/* Caption */}
      <p className="mt-2 text-ink-muted" style={{ fontSize: 12 }}>
        {nonZeroDays.length > 0
          ? `Your most active day: ${busiest}. Your quietest: ${quietest}.`
          : 'Start logging check-ins to see your activity heatmap.'}
      </p>
    </div>
  )
}
