// Pure analytics engine — no React, no database access.
// All functions are deterministic given the same inputs.

import type {
  AnalyticsEvent,
  CheckinCompletedMetadata,
  Goal,
  UserAnalytics,
  CoachingInsight,
  NudgeTimeResult,
  PredictionResult,
} from './schema'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function avg(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function msPerDay(): number {
  return 24 * 60 * 60 * 1000
}

// ─── calculateMomentumScore ───────────────────────────────────────────────────

/**
 * Weight: 40% check-in rate last 7 days, 30% streak consistency, 30% deadline proximity.
 * Returns 0–100. Below 40 = at risk. Above 75 = strong.
 */
export function calculateMomentumScore(goalEvents: AnalyticsEvent[]): number {
  if (goalEvents.length === 0) return 0

  const now = Date.now()
  const sevenDaysAgo = now - 7 * msPerDay()
  const fourteenDaysAgo = now - 14 * msPerDay()

  const checkins = goalEvents.filter((e) => e.eventType === 'checkin_completed')

  // 40% — check-in rate over last 7 days
  const recentCheckins = checkins.filter(
    (e) => e.occurredAt.getTime() >= sevenDaysAgo
  )
  // Rate: how many of the last 7 days had at least 1 check-in
  const daysWithCheckins7 = new Set(
    recentCheckins.map((e) => e.occurredAt.toISOString().slice(0, 10))
  ).size
  const checkinRate7 = clamp(daysWithCheckins7 / 7, 0, 1)

  // 30% — streak consistency (days with check-ins in last 14 days, normalised)
  const checkins14 = checkins.filter(
    (e) => e.occurredAt.getTime() >= fourteenDaysAgo
  )
  const daysWithCheckins14 = new Set(
    checkins14.map((e) => e.occurredAt.toISOString().slice(0, 10))
  ).size
  const streakScore = clamp(daysWithCheckins14 / 14, 0, 1)

  // 30% — deadline proximity factor
  // Closer to deadline with lower progress = lower score; on track or ahead = boost
  const goalCreatedEvents = goalEvents.filter((e) => e.eventType === 'goal_created')
  let deadlineFactor = 0.5 // neutral default

  if (goalCreatedEvents.length > 0) {
    const meta = goalCreatedEvents[goalCreatedEvents.length - 1]!.metadata as { targetDate?: string }
    if (meta.targetDate) {
      const daysLeft = (new Date(meta.targetDate).getTime() - now) / msPerDay()
      if (daysLeft > 0) {
        // If plenty of time left AND good check-in rate → high factor
        // If running out of time → factor depends on recent rate
        if (daysLeft > 60) deadlineFactor = 0.6 + checkinRate7 * 0.4
        else if (daysLeft > 14) deadlineFactor = checkinRate7
        else deadlineFactor = checkinRate7 * 0.7 // urgency penalty
      } else {
        deadlineFactor = 0  // past deadline
      }
    } else {
      deadlineFactor = 0.6 + checkinRate7 * 0.2
    }
  }

  const score = checkinRate7 * 40 + streakScore * 30 + deadlineFactor * 30
  return Math.round(clamp(score, 0, 100))
}

// ─── calculateOptimalNudgeTime ────────────────────────────────────────────────

/**
 * Groups all checkin_completed events by hour and dayOfWeek.
 * Returns the hour+day combo with the highest count.
 * Default: 8am Monday if < 10 checkin events.
 */
export function calculateOptimalNudgeTime(userEvents: AnalyticsEvent[]): NudgeTimeResult {
  const checkins = userEvents.filter((e) => e.eventType === 'checkin_completed')

  if (checkins.length < 10) {
    return { hour: 8, dayOfWeek: 1 }
  }

  // Build a 24×7 frequency grid
  const grid: number[][] = Array.from({ length: 24 }, () => new Array(7).fill(0))

  for (const event of checkins) {
    const meta = event.metadata as CheckinCompletedMetadata
    const hour = clamp(Math.floor(meta.timeOfDay ?? event.occurredAt.getHours()), 0, 23)
    const dow = meta.dayOfWeek ?? event.occurredAt.getDay()
    grid[hour]![dow]! += 1
  }

  let bestCount = -1
  let bestHour = 8
  let bestDay = 1

  for (let h = 0; h < 24; h++) {
    for (let d = 0; d < 7; d++) {
      if ((grid[h]![d] ?? 0) > bestCount) {
        bestCount = grid[h]![d]!
        bestHour = h
        bestDay = d
      }
    }
  }

  return { hour: bestHour, dayOfWeek: bestDay }
}

// ─── predictCompletionDate ────────────────────────────────────────────────────

/**
 * Projects when the goal will be completed at the current pace.
 * Confidence: 'high' if ≥14 checkin events, 'medium' if 5–13, 'low' if <5.
 */
export function predictCompletionDate(goal: Goal, recentEvents: AnalyticsEvent[]): PredictionResult {
  const now = new Date()
  const checkins = recentEvents.filter((e) => e.eventType === 'checkin_completed')
  const confidence: PredictionResult['confidence'] =
    checkins.length >= 14 ? 'high' : checkins.length >= 5 ? 'medium' : 'low'

  // Fall back: if no end date or targetValue, return 90 days from now at low confidence
  if (!goal.endDate || !goal.targetValue || goal.targetValue === 0) {
    const fallback = new Date(now.getTime() + 90 * msPerDay())
    return { date: fallback, confidence: 'low', daysAheadOrBehind: 0 }
  }

  // Calculate 14-day average daily check-in rate
  const fourteenDaysAgo = now.getTime() - 14 * msPerDay()
  const recent14 = checkins.filter((e) => e.occurredAt.getTime() >= fourteenDaysAgo)
  const daysWithCheckins = new Set(
    recent14.map((e) => e.occurredAt.toISOString().slice(0, 10))
  ).size
  const avgCheckinsPerDay = daysWithCheckins / 14

  // Remaining progress needed
  const progressPct = goal.targetValue > 0
    ? clamp(goal.currentValue / goal.targetValue, 0, 1)
    : 0
  const remainingPct = 1 - progressPct

  if (avgCheckinsPerDay <= 0) {
    return {
      date: new Date(goal.endDate.getTime() + 90 * msPerDay()),
      confidence,
      daysAheadOrBehind: -90,
    }
  }

  // Each check-in advances the goal by (1 / targetValue) units, approximated
  // as each check-in completing equal share of remaining work
  const daysToComplete = remainingPct / avgCheckinsPerDay
  const predictedDate = new Date(now.getTime() + daysToComplete * msPerDay())
  const daysAheadOrBehind = Math.round(
    (goal.endDate.getTime() - predictedDate.getTime()) / msPerDay()
  )

  return { date: predictedDate, confidence, daysAheadOrBehind }
}

// ─── calculatePeerEffectIndex ─────────────────────────────────────────────────

/**
 * Compares avg check-in rate for group goals vs solo goals.
 * Returns ratio (groupRate / soloRate). > 1.2 = groups significantly better.
 * Returns 1.0 if insufficient data.
 */
export function calculatePeerEffectIndex(userId: string, goals: Goal[]): number {
  const userGoals = goals.filter((g) => g.userId === userId)
  const soloGoals = userGoals.filter((g) => !g.groupId)
  const groupGoals = userGoals.filter((g) => !!g.groupId)

  if (soloGoals.length === 0 || groupGoals.length === 0) return 1.0

  function completionRate(gs: Goal[]): number {
    const rates = gs.map((g) => {
      if (!g.targetValue || g.targetValue === 0) return g.isCompleted ? 1 : 0
      return clamp(g.currentValue / g.targetValue, 0, 1)
    })
    return avg(rates)
  }

  const soloRate = completionRate(soloGoals)
  const groupRate = completionRate(groupGoals)

  if (soloRate === 0) return 1.0

  return Math.round((groupRate / soloRate) * 100) / 100
}

// ─── generateCoachingInsights ─────────────────────────────────────────────────

/**
 * Returns exactly 4 coaching insights from real user data.
 * Order: positive, warning, advice, prediction.
 */
export function generateCoachingInsights(userData: UserAnalytics): CoachingInsight[] {
  const now = new Date()
  const { goals, checkInRate7d, streakCurrent, streakLongest, bestDay, worstDay, peakHour } = userData

  const activeGoals = goals.filter((g) => !g.isCompleted)
  const completedGoals = goals.filter((g) => g.isCompleted)
  const groupGoals = goals.filter((g) => !!g.groupId)
  const peerIndex = calculatePeerEffectIndex(userData.userId, goals)
  const peakHourStr = peakHour < 12 ? `${peakHour}am` : peakHour === 12 ? '12pm' : `${peakHour - 12}pm`

  // ── Positive card ──────────────────────────────────────────────────────────
  const positiveBullets: string[] = []

  if (streakCurrent >= 7) {
    positiveBullets.push(`You have a ${streakCurrent}-day streak — your longest run this cycle.`)
  } else if (streakCurrent >= 3) {
    positiveBullets.push(`You have checked in ${streakCurrent} days straight — a strong start.`)
  }

  if (checkInRate7d >= 0.7) {
    positiveBullets.push(`You checked in ${Math.round(checkInRate7d * 7)} of 7 days this week — top performance.`)
  }

  const bestGoal = activeGoals.reduce(
    (best, g) =>
      g.targetValue && g.currentValue / g.targetValue > (best?.currentValue ?? 0) / (best?.targetValue ?? 1)
        ? g
        : best,
    activeGoals[0]
  )
  if (bestGoal?.targetValue) {
    const pct = Math.round((bestGoal.currentValue / bestGoal.targetValue) * 100)
    if (pct >= 50) {
      positiveBullets.push(`"${bestGoal.title}" is ${pct}% complete — your strongest goal right now.`)
    }
  }

  if (positiveBullets.length < 2) {
    positiveBullets.push(`You check in most on ${bestDay} — protect that slot.`)
  }

  const positiveCard: CoachingInsight = {
    type: 'positive',
    title: 'What you are doing well',
    bullets: positiveBullets.slice(0, 3),
    cta: { label: 'View streak', action: '/analytics' },
    generatedAt: now.toISOString(),
  }

  // ── Warning card ───────────────────────────────────────────────────────────
  const warningBullets: string[] = []

  const atRiskGoals = activeGoals.filter((g) => {
    if (!g.endDate) return false
    const daysLeft = (g.endDate.getTime() - now.getTime()) / msPerDay()
    const pct = g.targetValue ? g.currentValue / g.targetValue : 0
    return daysLeft <= 14 && pct < 0.4
  })

  if (atRiskGoals.length > 0) {
    const g = atRiskGoals[0]!
    const daysLeft = g.endDate
      ? Math.ceil((g.endDate.getTime() - now.getTime()) / msPerDay())
      : 0
    warningBullets.push(`"${g.title}" has ${daysLeft} days left and is under 40% complete.`)
  }

  if (checkInRate7d < 0.4) {
    warningBullets.push(`You missed check-ins on ${7 - Math.round(checkInRate7d * 7)} of the last 7 days.`)
  }

  if (worstDay) {
    warningBullets.push(`You have zero check-ins on ${worstDay}s this month — a pattern to fix.`)
  }

  if (warningBullets.length < 2) {
    warningBullets.push('Your recent completion pace has slowed compared to last week.')
  }

  const warningCard: CoachingInsight = {
    type: 'warning',
    title: 'Where you are slipping',
    bullets: warningBullets.slice(0, 3),
    cta: { label: 'Review goals', action: '/goals' },
    generatedAt: now.toISOString(),
  }

  // ── Advice card ────────────────────────────────────────────────────────────
  const adviceBullets: string[] = []

  adviceBullets.push(`Move your hardest goal to ${peakHourStr} — that is when you complete most tasks.`)

  if (activeGoals.length > 3) {
    adviceBullets.push(`You have ${activeGoals.length} active goals. Focus on the top 3 to improve follow-through.`)
  }

  const noIntentionGoals = activeGoals.filter((g) => !g.endDate)
  if (noIntentionGoals.length > 0) {
    adviceBullets.push(`Set a deadline on "${noIntentionGoals[0]!.title}" — open goals complete 2× slower.`)
  }

  if (adviceBullets.length < 2) {
    adviceBullets.push(`Schedule a ${worstDay} intention. You have no mid-week check-ins.`)
  }

  const adviceCard: CoachingInsight = {
    type: 'advice',
    title: 'What to change next',
    bullets: adviceBullets.slice(0, 3),
    cta: { label: 'Add intention', action: '/goals' },
    generatedAt: now.toISOString(),
  }

  // ── Prediction card ────────────────────────────────────────────────────────
  const predictionBullets: string[] = []

  if (atRiskGoals[0] && atRiskGoals[0].endDate) {
    const pred = predictCompletionDate(atRiskGoals[0], userData.events)
    if (pred.daysAheadOrBehind < 0) {
      predictionBullets.push(
        `At current pace, "${atRiskGoals[0].title}" finishes ${Math.abs(pred.daysAheadOrBehind)} days late.`
      )
    }
  }

  if (peerIndex > 1.2 && groupGoals.length > 0) {
    predictionBullets.push(
      `Group goals complete ${Math.round((peerIndex - 1) * 100)}% faster for you — invite someone.`
    )
  }

  if (checkInRate7d >= 0.8 && streakCurrent >= 7) {
    predictionBullets.push(
      `At this pace you will complete ${completedGoals.length + 1} goals by end of month.`
    )
  }

  if (predictionBullets.length < 2) {
    predictionBullets.push(`Add 2 check-ins per week to stay on track across all active goals.`)
  }

  const predictionCard: CoachingInsight = {
    type: 'prediction',
    title: 'What to expect ahead',
    bullets: predictionBullets.slice(0, 3),
    cta: { label: 'See full forecast', action: '/analytics' },
    generatedAt: now.toISOString(),
  }

  return [positiveCard, warningCard, adviceCard, predictionCard]
}
