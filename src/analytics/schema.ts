// Pure TypeScript types for the analytics event system.
// No runtime code — safe to import from both client and server.

// ─── Behavioral event types ───────────────────────────────────────────────────

export type BehavioralEventType =
  | 'checkin_completed'
  | 'checkin_skipped'
  | 'goal_created'
  | 'goal_edited'
  | 'notification_opened'
  | 'session_started'
  | 'feature_used'

export interface CheckinCompletedMetadata {
  goalId: string
  mood: 1 | 2 | 3 | 4 | 5
  effortRating: 1 | 2 | 3 | 4 | 5
  noteText?: string
  timeOfDay: number   // hour 0–23
  dayOfWeek: number  // 0=Sun, 6=Sat
}

export interface CheckinSkippedMetadata {
  goalId: string
  skipReason: 'busy' | 'forgot' | 'unmotivated' | 'other'
  timeOfDay: number
}

export interface GoalCreatedMetadata {
  goalId: string
  category: string
  complexity: 'low' | 'medium' | 'high'
  hasIntentions: boolean
  isGroupGoal: boolean
  targetDate?: string  // ISO date
}

export interface GoalEditedMetadata {
  goalId: string
  fieldChanged: string
  daysUntilDeadline?: number
}

export interface NotificationOpenedMetadata {
  notificationId: string
  hourOfDay: number
  dayOfWeek: number
}

export interface SessionStartedMetadata {
  screenLanded: string
  sessionLengthSeconds?: number
}

export interface FeatureUsedMetadata {
  featureName: string
}

export type EventMetadata =
  | CheckinCompletedMetadata
  | CheckinSkippedMetadata
  | GoalCreatedMetadata
  | GoalEditedMetadata
  | NotificationOpenedMetadata
  | SessionStartedMetadata
  | FeatureUsedMetadata

export interface AnalyticsEvent {
  id: string
  userId: string
  eventType: BehavioralEventType
  metadata: EventMetadata
  occurredAt: Date
}

// ─── Goal state snapshot ──────────────────────────────────────────────────────

export interface GoalSnapshot {
  goalId: string
  userId: string
  snapshotDate: string     // ISO date "YYYY-MM-DD"
  checkInRate7d: number    // 0–1
  checkInRate30d: number   // 0–1
  daysAheadOrBehind: number  // positive = ahead, negative = behind schedule
  momentumScore: number    // 0–100
  predictedCompletionDate: string  // ISO date
  atRiskFlag: boolean
  streakCurrent: number
  streakLongest: number
}

// ─── Engine input types ───────────────────────────────────────────────────────

export interface Goal {
  id: string
  userId: string
  title: string
  category: string
  startDate?: Date
  endDate?: Date
  targetValue?: number
  currentValue: number
  isCompleted: boolean
  groupId?: string  // set if this is a group goal
}

export interface UserAnalytics {
  userId: string
  goals: Goal[]
  events: AnalyticsEvent[]
  snapshots: GoalSnapshot[]
  checkInRate7d: number
  checkInRate30d: number
  streakCurrent: number
  streakLongest: number
  momentumScore: number
  bestDay: string   // e.g. "Tuesday"
  worstDay: string
  peakHour: number  // 0–23
}

// ─── Engine output types ──────────────────────────────────────────────────────

export interface CoachingInsight {
  type: 'positive' | 'warning' | 'advice' | 'prediction'
  title: string       // 3–5 words, sentence case, no punctuation
  bullets: string[]   // 2–4 items, each ≤ 80 chars, starts with "You" or action verb
  cta: { label: string; action: string }
  generatedAt: string // ISO datetime
}

export interface NudgeTimeResult {
  hour: number       // 0–23
  dayOfWeek: number  // 0=Sun, 6=Sat
}

export interface PredictionResult {
  date: Date
  confidence: 'high' | 'medium' | 'low'
  daysAheadOrBehind: number  // positive = ahead
}
