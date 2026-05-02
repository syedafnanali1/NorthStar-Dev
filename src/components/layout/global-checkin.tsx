'use client'

import { useEffect, useState, useCallback } from 'react'
import { format, differenceInDays, parseISO } from 'date-fns'
import DailyCheckinSheet from '@/modals/DailyCheckinSheet'

interface GoalSummary {
  id: string
  title: string
  startDate: string | Date | null
  isCompleted: boolean | null
}

function weekLabel(goal: GoalSummary): string {
  if (!goal.startDate) return format(new Date(), 'MMMM yyyy')
  const start = typeof goal.startDate === 'string' ? parseISO(goal.startDate) : goal.startDate
  const daysDiff = differenceInDays(new Date(), start)
  const week = Math.max(1, Math.floor(daysDiff / 7) + 1)
  return `Week ${week} · ${format(new Date(), 'MMMM yyyy')}`
}

export function GlobalCheckin() {
  const [open, setOpen] = useState(false)
  const [goals, setGoals] = useState<GoalSummary[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [loading, setLoading] = useState(false)

  const openCheckin = useCallback(async () => {
    if (loading) return
    setLoading(true)
    try {
      const r = await fetch('/api/goals')
      if (!r.ok) return
      const data = await r.json() as { goals?: GoalSummary[] }
      const active = (data.goals ?? []).filter((g) => !g.isCompleted)
      if (active.length === 0) return
      setGoals(active)
      setSelectedIdx(0)
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }, [loading])

  useEffect(() => {
    const handler = () => { void openCheckin() }
    window.addEventListener('northstar:open-checkin', handler)
    return () => window.removeEventListener('northstar:open-checkin', handler)
  }, [openCheckin])

  const selected = goals[selectedIdx]
  if (!selected) return null

  return (
    <DailyCheckinSheet
      isOpen={open}
      goalName={selected.title}
      weekLabel={weekLabel(selected)}
      goalId={selected.id}
      onClose={() => setOpen(false)}
    />
  )
}
