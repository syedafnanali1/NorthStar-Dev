import {
  calculateMomentumScore,
  calculateOptimalNudgeTime,
  predictCompletionDate,
  calculatePeerEffectIndex,
  generateCoachingInsights,
} from './engine'
import type { AnalyticsEvent, Goal, UserAnalytics } from './schema'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

function makeCheckin(goalId: string, daysBack: number, hour = 8, dow = 1): AnalyticsEvent {
  return {
    id: `evt_${Math.random().toString(36).slice(2)}`,
    userId: 'user_test',
    eventType: 'checkin_completed',
    metadata: {
      goalId,
      mood: 4,
      effortRating: 3,
      timeOfDay: hour,
      dayOfWeek: dow,
    },
    occurredAt: daysAgo(daysBack),
  }
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: `goal_${Math.random().toString(36).slice(2)}`,
    userId: 'user_test',
    title: 'Read Daily',
    category: 'mindset',
    currentValue: 0,
    isCompleted: false,
    ...overrides,
  }
}

// ─── calculateMomentumScore ───────────────────────────────────────────────────

describe('calculateMomentumScore', () => {
  it('returns 0 for empty events', () => {
    expect(calculateMomentumScore([])).toBe(0)
  })

  it('returns high score (≥70) for daily check-ins over last 7 days', () => {
    const events: AnalyticsEvent[] = [0, 1, 2, 3, 4, 5, 6].map((d) =>
      makeCheckin('goal_abc', d)
    )
    const score = calculateMomentumScore(events)
    expect(score).toBeGreaterThanOrEqual(70)
  })

  it('returns low score (<40) when no check-ins in last 7 days', () => {
    const events: AnalyticsEvent[] = [8, 9, 10, 11, 12].map((d) =>
      makeCheckin('goal_abc', d)
    )
    const score = calculateMomentumScore(events)
    expect(score).toBeLessThan(40)
  })

  it('returns value in 0–100 range', () => {
    const events: AnalyticsEvent[] = [0, 1, 2, 3, 7, 8, 9].map((d) =>
      makeCheckin('goal_abc', d)
    )
    const score = calculateMomentumScore(events)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})

// ─── calculateOptimalNudgeTime ────────────────────────────────────────────────

describe('calculateOptimalNudgeTime', () => {
  it('returns default 8am Monday when fewer than 10 events', () => {
    const events = [0, 1, 2].map((d) => makeCheckin('goal_abc', d, 9, 3))
    const result = calculateOptimalNudgeTime(events)
    expect(result).toEqual({ hour: 8, dayOfWeek: 1 })
  })

  it('returns the most frequent hour+day combo', () => {
    // 12 events at 7am on Wednesday (dow=3)
    const events: AnalyticsEvent[] = Array.from({ length: 12 }, (_, i) =>
      makeCheckin('goal_abc', i, 7, 3)
    )
    const result = calculateOptimalNudgeTime(events)
    expect(result.hour).toBe(7)
    expect(result.dayOfWeek).toBe(3)
  })

  it('returns default when events list is empty', () => {
    const result = calculateOptimalNudgeTime([])
    expect(result).toEqual({ hour: 8, dayOfWeek: 1 })
  })
})

// ─── predictCompletionDate ────────────────────────────────────────────────────

describe('predictCompletionDate', () => {
  it('returns low confidence when fewer than 5 events', () => {
    const goal = makeGoal({
      targetValue: 100,
      currentValue: 20,
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
    const { confidence } = predictCompletionDate(goal, [makeCheckin(goal.id, 0)])
    expect(confidence).toBe('low')
  })

  it('returns high confidence when 14+ events', () => {
    const goal = makeGoal({
      targetValue: 100,
      currentValue: 50,
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
    const events = Array.from({ length: 14 }, (_, i) => makeCheckin(goal.id, i))
    const { confidence } = predictCompletionDate(goal, events)
    expect(confidence).toBe('high')
  })

  it('returns a future date when there are recent check-ins', () => {
    const goal = makeGoal({
      targetValue: 100,
      currentValue: 10,
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    })
    const events = Array.from({ length: 7 }, (_, i) => makeCheckin(goal.id, i))
    const { date } = predictCompletionDate(goal, events)
    expect(date.getTime()).toBeGreaterThan(Date.now())
  })

  it('handles goal with no endDate gracefully', () => {
    const goal = makeGoal({ targetValue: 50, currentValue: 10 })
    const { confidence } = predictCompletionDate(goal, [])
    expect(confidence).toBe('low')
  })
})

// ─── calculatePeerEffectIndex ─────────────────────────────────────────────────

describe('calculatePeerEffectIndex', () => {
  it('returns 1.0 when no group goals exist', () => {
    const goals: Goal[] = [
      makeGoal({ userId: 'user_test', currentValue: 60, targetValue: 100 }),
      makeGoal({ userId: 'user_test', currentValue: 40, targetValue: 100 }),
    ]
    expect(calculatePeerEffectIndex('user_test', goals)).toBe(1.0)
  })

  it('returns > 1.2 when group goals have higher completion rate', () => {
    const soloGoals: Goal[] = [
      makeGoal({ userId: 'user_test', currentValue: 20, targetValue: 100 }),
      makeGoal({ userId: 'user_test', currentValue: 30, targetValue: 100 }),
    ]
    const groupGoals: Goal[] = [
      makeGoal({ userId: 'user_test', groupId: 'grp_1', currentValue: 85, targetValue: 100 }),
      makeGoal({ userId: 'user_test', groupId: 'grp_1', currentValue: 90, targetValue: 100 }),
    ]
    const index = calculatePeerEffectIndex('user_test', [...soloGoals, ...groupGoals])
    expect(index).toBeGreaterThan(1.2)
  })

  it('returns 1.0 when no solo goals exist', () => {
    const goals: Goal[] = [
      makeGoal({ userId: 'user_test', groupId: 'grp_1', currentValue: 50, targetValue: 100 }),
    ]
    expect(calculatePeerEffectIndex('user_test', goals)).toBe(1.0)
  })
})

// ─── generateCoachingInsights ─────────────────────────────────────────────────

describe('generateCoachingInsights', () => {
  const baseUserData: UserAnalytics = {
    userId: 'user_test',
    goals: [
      makeGoal({ title: 'Spanish', targetValue: 100, currentValue: 30, endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) }),
      makeGoal({ title: 'Exercise', targetValue: 50, currentValue: 45 }),
    ],
    events: Array.from({ length: 10 }, (_, i) => makeCheckin('goal_abc', i)),
    snapshots: [],
    checkInRate7d: 0.71,
    checkInRate30d: 0.6,
    streakCurrent: 7,
    streakLongest: 14,
    momentumScore: 72,
    bestDay: 'Tuesday',
    worstDay: 'Friday',
    peakHour: 8,
  }

  it('returns exactly 4 insights', () => {
    const insights = generateCoachingInsights(baseUserData)
    expect(insights).toHaveLength(4)
  })

  it('has one of each type: positive, warning, advice, prediction', () => {
    const insights = generateCoachingInsights(baseUserData)
    const types = insights.map((i) => i.type)
    expect(types).toContain('positive')
    expect(types).toContain('warning')
    expect(types).toContain('advice')
    expect(types).toContain('prediction')
  })

  it('each insight has 2–4 bullets all ≤80 chars', () => {
    const insights = generateCoachingInsights(baseUserData)
    for (const insight of insights) {
      expect(insight.bullets.length).toBeGreaterThanOrEqual(2)
      expect(insight.bullets.length).toBeLessThanOrEqual(4)
      for (const bullet of insight.bullets) {
        expect(bullet.length).toBeLessThanOrEqual(80)
      }
    }
  })

  it('works with minimal data (no goals, no events)', () => {
    const minimalData: UserAnalytics = {
      ...baseUserData,
      goals: [],
      events: [],
      checkInRate7d: 0,
      streakCurrent: 0,
    }
    const insights = generateCoachingInsights(minimalData)
    expect(insights).toHaveLength(4)
  })
})
