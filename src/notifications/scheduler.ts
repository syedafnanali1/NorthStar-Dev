// Notification scheduler — server-side module, no React.
// Implements the priority queue and copy template rules.

export interface GoalData {
  id: string
  title: string
  streakCurrent: number
  daysMissed: number
  daysLate: number
  userCheckedInToday: boolean
}

export interface GroupCheckin {
  goalId: string
  goalTitle: string
  memberName: string
  memberCount: number
  userCheckedIn: boolean
}

export interface UserNotificationConfig {
  userId: string
  optimalNudgeHour: number    // 0–23
  optimalNudgeDay: number     // 0=Sun, 6=Sat
  atRiskGoals: GoalData[]
  goalsWithTodayIntentions: GoalData[]
  streakGoals: GoalData[]     // streakCurrent >= 3
  generalGoals: GoalData[]
  lastNotificationSentAt?: Date
  groupMembersCheckedIn: GroupCheckin[]
}

export type NotificationType = 'streak_protect' | 'behind' | 'peer' | 'celebration' | 'weekly'

export interface ScheduledNotification {
  userId: string
  type: NotificationType
  goalId?: string
  title: string
  body: string
  scheduledFor: Date
}

/** Clamps a nudge hour to the quiet-hours window (7am–9pm). */
function safeHour(hour: number): number {
  return Math.max(7, Math.min(21, hour))
}

function scheduledDate(today: Date, hour: number): Date {
  const d = new Date(today)
  d.setHours(hour, 0, 0, 0)
  return d
}

/**
 * Builds the single highest-priority notification for a user on a given day.
 * Rules:
 * 1. Max 1 goal reminder per day
 * 2. Priority: atRisk → intentions → streak protect → general
 * 3. Never schedule between 22:00–07:00
 * 4. Streak protection fires at 22:00 if user has streak ≥ 3 and hasn't checked in
 * 5. Peer nudge: ≥ 2 members checked in and user hasn't, max 1/day
 * 6. Weekly: Sunday at optimalNudgeHour
 */
export function buildDayNotifications(
  config: UserNotificationConfig,
  today: Date
): ScheduledNotification[] {
  const results: ScheduledNotification[] = []
  const nudgeHour = safeHour(config.optimalNudgeHour)
  const isSunday = today.getDay() === 0

  // Weekly insights on Sunday
  if (isSunday) {
    const copy = formatNotificationCopy('weekly', { n: 0, r: 0 })
    results.push({
      userId: config.userId,
      type: 'weekly',
      title: copy.title,
      body: copy.body,
      scheduledFor: scheduledDate(today, nudgeHour),
    })
    return results
  }

  // 1. Peer nudge (up to 1/day, independent of goal nudge)
  if (shouldSendPeerNudge(config, today)) {
    const peer = config.groupMembersCheckedIn.find((g) => !g.userCheckedIn && g.memberCount >= 2)
    if (peer) {
      const copy = formatNotificationCopy('peer', { goalName: peer.goalTitle, memberName: peer.memberName })
      results.push({
        userId: config.userId,
        type: 'peer',
        goalId: peer.goalId,
        title: copy.title,
        body: copy.body,
        scheduledFor: scheduledDate(today, nudgeHour),
      })
      // Peer nudge is separate — still may send a goal nudge
    }
  }

  // 2. At-risk goal nudge (highest priority goal reminder)
  const atRisk = config.atRiskGoals[0]
  if (atRisk) {
    const copy = formatNotificationCopy('behind', { goalName: atRisk.title, n: atRisk.daysMissed })
    results.push({
      userId: config.userId,
      type: 'behind',
      goalId: atRisk.id,
      title: copy.title,
      body: copy.body,
      scheduledFor: scheduledDate(today, nudgeHour),
    })
    return results
  }

  // 3. Goals with today's intentions
  const intentionGoal = config.goalsWithTodayIntentions[0]
  if (intentionGoal) {
    const copy = formatNotificationCopy('behind', { goalName: intentionGoal.title, n: intentionGoal.daysMissed })
    results.push({
      userId: config.userId,
      type: 'behind',
      goalId: intentionGoal.id,
      title: copy.title,
      body: copy.body,
      scheduledFor: scheduledDate(today, nudgeHour),
    })
    return results
  }

  // 4. Streak protection — fires at 22:00 (2h before midnight)
  const streakGoal = config.streakGoals.find((g) => !g.userCheckedInToday && g.streakCurrent >= 3)
  if (streakGoal) {
    const copy = formatNotificationCopy('streak_protect', { goalName: streakGoal.title, n: streakGoal.streakCurrent })
    results.push({
      userId: config.userId,
      type: 'streak_protect',
      goalId: streakGoal.id,
      title: copy.title,
      body: copy.body,
      scheduledFor: scheduledDate(today, 22),
    })
    return results
  }

  // 5. General reminder for any unchecked goal
  const general = config.generalGoals.find((g) => !g.userCheckedInToday)
  if (general) {
    const copy = formatNotificationCopy('behind', { goalName: general.title, n: general.daysMissed })
    results.push({
      userId: config.userId,
      type: 'behind',
      goalId: general.id,
      title: copy.title,
      body: copy.body,
      scheduledFor: scheduledDate(today, nudgeHour),
    })
  }

  return results
}

/**
 * Formats notification copy from templates.
 * All bodies capped at 60 chars. No exclamation marks except celebration.
 */
export function formatNotificationCopy(
  type: NotificationType,
  data: { goalName?: string; n?: number; c?: number; r?: number; memberName?: string }
): { title: string; body: string } {
  function cap(s: string): string {
    return s.length > 60 ? s.slice(0, 57) + '…' : s
  }

  const goal = data.goalName ?? 'Your goal'
  const n = data.n ?? 0

  switch (type) {
    case 'streak_protect':
      return {
        title: 'Streak at risk',
        body: cap(`${goal}: ${n}-day streak — 1 check-in saves it`),
      }
    case 'behind':
      return {
        title: goal.length > 20 ? goal.slice(0, 20) + '…' : goal,
        body: cap(`${goal}: ${n} day${n !== 1 ? 's' : ''} without a check-in. One step helps.`),
      }
    case 'peer':
      return {
        title: 'Your group is active',
        body: cap(`${data.memberName ?? 'Someone'} checked in on ${goal}. You're up.`),
      }
    case 'celebration':
      return {
        title: 'Goal complete!',
        body: cap(`You completed ${goal} — ${n} days, ${data.c ?? 0} check-ins.`),
      }
    case 'weekly':
      return {
        title: 'Your week in numbers',
        body: cap(`Your week: ${n} check-ins, ${data.r ?? 0}% completion.`),
      }
  }
}

/**
 * Returns true if a peer nudge should be sent:
 * - ≥ 2 group members checked in on any goal today
 * - User has NOT checked in on that goal today
 * - User has not received a notification within the last 22 hours
 */
export function shouldSendPeerNudge(config: UserNotificationConfig, today: Date): boolean {
  if (config.lastNotificationSentAt) {
    const hoursAgo = (today.getTime() - config.lastNotificationSentAt.getTime()) / (60 * 60 * 1000)
    if (hoursAgo < 22) return false
  }

  return config.groupMembersCheckedIn.some(
    (g) => g.memberCount >= 2 && !g.userCheckedIn
  )
}
