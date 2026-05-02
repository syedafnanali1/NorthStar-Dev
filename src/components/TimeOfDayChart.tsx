'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts'

interface HourData {
  hour: number
  completionRate: number
  count: number
}

interface TimeOfDayChartProps {
  data: HourData[]
  peakWindowStart?: number
  peakWindowEnd?: number
  className?: string
}

function formatHour(h: number): string {
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

function barColor(rate: number): string {
  if (rate >= 0.7) return '#1D9E75'
  if (rate >= 0.4) return '#EF9F27'
  return '#CBD0D8'
}

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload as HourData
  return (
    <div className="rounded-lg bg-white border border-cream-dark shadow-card px-3 py-2" style={{ fontSize: 12 }}>
      <p className="font-medium text-ink">{formatHour(d.hour)}</p>
      <p className="text-ink-soft">{Math.round(d.completionRate * 100)}% completion</p>
      <p className="text-ink-muted">{d.count} check-in{d.count !== 1 ? 's' : ''}</p>
    </div>
  )
}

const SAMPLE_DATA: HourData[] = [
  { hour: 6, completionRate: 0.45, count: 5 },
  { hour: 7, completionRate: 0.55, count: 8 },
  { hour: 8, completionRate: 0.82, count: 14 },
  { hour: 9, completionRate: 0.75, count: 12 },
  { hour: 10, completionRate: 0.65, count: 9 },
  { hour: 12, completionRate: 0.50, count: 7 },
  { hour: 13, completionRate: 0.45, count: 6 },
  { hour: 17, completionRate: 0.70, count: 11 },
  { hour: 18, completionRate: 0.68, count: 10 },
  { hour: 20, completionRate: 0.35, count: 4 },
  { hour: 21, completionRate: 0.30, count: 3 },
]

export default function TimeOfDayChart({
  data,
  peakWindowStart,
  peakWindowEnd,
  className,
}: TimeOfDayChartProps) {
  const chartData = data.length > 0 ? data : SAMPLE_DATA
  const isEmpty = data.length === 0

  const peakStart = peakWindowStart ?? 8
  const peakEnd = peakWindowEnd ?? 10

  return (
    <div className={className}>
      {isEmpty && (
        <p className="text-center text-ink-muted mb-2" style={{ fontSize: 12 }}>
          Sample data shown — check in to see your real pattern
        </p>
      )}
      <div style={{ opacity: isEmpty ? 0.4 : 1 }}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
          >
            <XAxis
              type="number"
              domain={[0, 1]}
              tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              tick={{ fontSize: 11, fill: '#8C857D' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              dataKey="hour"
              type="category"
              tickFormatter={formatHour}
              tick={{ fontSize: 11, fill: '#8C857D' }}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <Bar dataKey="completionRate" radius={[0, 4, 4, 0]} maxBarSize={16}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={barColor(entry.completionRate)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-ink-muted italic" style={{ fontSize: 12 }}>
        Your peak window: {formatHour(peakStart)}–{formatHour(peakEnd)}. Schedule hard goals here.
      </p>
    </div>
  )
}
