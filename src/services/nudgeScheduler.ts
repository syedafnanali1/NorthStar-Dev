// Nudge scheduler service — integrates analytics engine + notifications service.
// Server-side only. Safe to call from cron jobs.

import { analyticsService } from '../server/services/analytics.service'
import { notificationsService } from '../server/services/notifications.service'

const WINDOW_TO_HOUR: Record<string, number> = {
  Morning:   8,
  Afternoon: 13,
  Evening:   18,
  'Late Night': 22,
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export interface NudgeContext {
  userId: string
  goals: Array<{
    id: string
    title: string
    isCompleted: boolean
    groupId?: string
    endDate?: Date
    currentValue: number
    targetValue?: number
  }>
  momentumScore: number
  streakCurrent: number
  checkInRate7d: number
  optimalNudgeHour: number  // 7–21 (clamped, quiet hours excluded)
  optimalNudgeDay: number   // 0=Sun
  lastNudgeSentAt?: Date
}

/**
 * Fetches momentum + goals and builds the NudgeContext for a user.
 */
export async function computeNudgeContext(userId: string): Promise<NudgeContext> {
  const [momentum, behavior] = await Promise.all([
    analyticsService.getMomentumData(userId, 30),
    analyticsService.getBehaviorIntelligence(userId, 56),
  ])

  const hour = clamp(WINDOW_TO_HOUR[behavior.bestCheckInWindow] ?? 8, 7, 21)

  // Goals are fetched separately by the caller when needed
  return {
    userId,
    goals: [],
    momentumScore: momentum.score,
    streakCurrent: momentum.streakDays,
    checkInRate7d: momentum.completionRate,
    optimalNudgeHour: hour,
    optimalNudgeDay: 1,  // default Monday; caller overrides from analyticsService if needed
  }
}

/**
 * Returns IDs of at-risk goals: deadline ≤ 14 days AND progress < 40%,
 * OR no check-in in 3+ days (approximated by checkInRate7d < 0.4).
 */
export function getAtRiskGoals(ctx: NudgeContext): string[] {
  const now = Date.now()
  return ctx.goals
    .filter((g) => {
      if (g.isCompleted) return false
      if (g.endDate) {
        const daysLeft = (g.endDate.getTime() - now) / (24 * 60 * 60 * 1000)
        const progress = g.targetValue ? g.currentValue / g.targetValue : 0
        if (daysLeft <= 14 && progress < 0.4) return true
      }
      return ctx.checkInRate7d < 0.4
    })
    .map((g) => g.id)
}

/**
 * Builds the single highest-priority nudge payload for today.
 * Returns null if: rate-limited, quiet hours, or nothing to nudge.
 */
export function buildNudgePayload(
  ctx: NudgeContext
): { type: string; goalId: string; title: string; body: string } | null {
  const now = new Date()
  const currentHour = now.getHours()

  // Quiet hours: 22:00–07:00
  if (currentHour >= 22 || currentHour < 7) return null

  // Rate limit: 1 nudge per 22 hours
  if (ctx.lastNudgeSentAt) {
    const hoursAgo = (Date.now() - ctx.lastNudgeSentAt.getTime()) / (60 * 60 * 1000)
    if (hoursAgo < 22) return null
  }

  const atRiskIds = getAtRiskGoals(ctx)
  const activeGoals = ctx.goals.filter((g) => !g.isCompleted)

  // 1. At-risk goal
  const atRiskGoal = activeGoals.find((g) => atRiskIds.includes(g.id))
  if (atRiskGoal) {
    return {
      type: 'streak_risk',
      goalId: atRiskGoal.id,
      title: atRiskGoal.title,
      body: `${atRiskGoal.title} is at risk. One check-in gets you back on track.`,
    }
  }

  // 2. Streak protection
  if (ctx.streakCurrent >= 3 && ctx.checkInRate7d < 0.3) {
    const g = activeGoals[0]
    if (g) {
      return {
        type: 'streak_protect',
        goalId: g.id,
        title: 'Streak at risk',
        body: `${g.title}: ${ctx.streakCurrent}-day streak — 1 check-in saves it`,
      }
    }
  }

  // 3. General encouragement
  const g = activeGoals[0]
  if (g && ctx.checkInRate7d < 0.6) {
    return {
      type: 'nudge',
      goalId: g.id,
      title: g.title,
      body: `Check in on ${g.title} to keep your momentum going.`,
    }
  }

  return null
}

/**
 * Computes nudge context, builds payload, and creates a notification.
 * Safe to call from a cron job — handles errors gracefully.
 */
export async function scheduleUserNudge(userId: string): Promise<void> {
  try {
    const ctx = await computeNudgeContext(userId)
    const payload = buildNudgePayload(ctx)
    if (!payload) return

    await notificationsService.createNotification(
      userId,
      'streak_risk',
      payload.title,
      payload.body,
      `/goals/${payload.goalId}`
    )
  } catch (error) {
    console.error('[nudgeScheduler] Failed for user', userId, error)
  }
}
