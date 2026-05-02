# Analytics Schema Documentation

## Overview

NorthStar's analytics system captures behavioral events and daily goal snapshots to power momentum scoring, coaching insights, nudge timing, and completion prediction.

Events are stored in the existing `analytics_events` table. Goal snapshots are computed daily by the engine and cached in user/goal state. The engine (`src/analytics/engine.ts`) is pure TypeScript — no database access, fully testable.

---

## Behavioral Event Types

All events share the base shape:
```ts
{
  id: string          // auto-generated
  userId: string      // FK → users.id
  eventType: string   // one of the 7 types below
  metadata: object    // type-specific payload (see below)
  occurredAt: Date    // server timestamp
}
```

### Event Reference

| Event Type | When It Fires | Key Metadata Fields |
|---|---|---|
| `checkin_completed` | User logs a check-in | `goalId`, `mood` (1–5), `effortRating` (1–5), `noteText?`, `timeOfDay` (hour 0–23), `dayOfWeek` (0–6) |
| `checkin_skipped` | User explicitly skips | `goalId`, `skipReason` (`busy`\|`forgot`\|`unmotivated`\|`other`), `timeOfDay` |
| `goal_created` | New goal saved | `goalId`, `category`, `complexity` (`low`\|`medium`\|`high`), `hasIntentions`, `isGroupGoal`, `targetDate?` |
| `goal_edited` | Goal field changed | `goalId`, `fieldChanged`, `daysUntilDeadline?` |
| `notification_opened` | User taps a notification | `notificationId`, `hourOfDay`, `dayOfWeek` |
| `session_started` | App opened / foregrounded | `screenLanded`, `sessionLengthSeconds?` |
| `feature_used` | Feature interaction | `featureName` |

### TypeScript Interfaces

```ts
// src/analytics/schema.ts (source of truth)

type BehavioralEventType =
  | 'checkin_completed'
  | 'checkin_skipped'
  | 'goal_created'
  | 'goal_edited'
  | 'notification_opened'
  | 'session_started'
  | 'feature_used'

interface CheckinCompletedMetadata {
  goalId: string
  mood: 1 | 2 | 3 | 4 | 5
  effortRating: 1 | 2 | 3 | 4 | 5
  noteText?: string
  timeOfDay: number   // hour 0–23
  dayOfWeek: number  // 0=Sun, 6=Sat
}

interface AnalyticsEvent {
  id: string
  userId: string
  eventType: BehavioralEventType
  metadata: EventMetadata
  occurredAt: Date
}
```

### Emitting Events from the Frontend

```ts
// POST /api/analytics/events
await fetch('/api/analytics/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventType: 'checkin_completed',
    metadata: {
      goalId: 'goal_abc123',
      mood: 4,
      effortRating: 3,
      timeOfDay: 8,     // 8am
      dayOfWeek: 2,     // Tuesday
    }
  })
})
```

---

## Goal State Snapshots

Updated daily per goal via background cron. Stored as denormalized fields on the `users` table and computed by the analytics engine on demand.

| Field | Type | Description | Update Frequency |
|---|---|---|---|
| `checkInRate7d` | `float` (0–1) | Fraction of last 7 days with ≥1 check-in | Daily |
| `checkInRate30d` | `float` (0–1) | Fraction of last 30 days with ≥1 check-in | Daily |
| `daysAheadOrBehind` | `int` | Positive = ahead of schedule, negative = behind | Daily |
| `momentumScore` | `float` (0–100) | Composite score (see engine) | On demand + daily |
| `predictedCompletionDate` | ISO date | Projected finish at current pace | Daily |
| `atRiskFlag` | `boolean` | `true` if score < 40 or deadline ≤14 days with progress < 40% | Daily |
| `streakCurrent` | `int` | Consecutive days with ≥1 check-in | On check-in |
| `streakLongest` | `int` | All-time longest streak | On check-in |

---

## Engine Function Reference

All functions live in `src/analytics/engine.ts`. They are pure and side-effect-free.

### `calculateMomentumScore(goalEvents)`
- **Input**: `AnalyticsEvent[]` for one goal
- **Output**: `number` (0–100)
- **Algorithm**: 40% × check-in rate last 7 days + 30% × streak consistency (days with check-ins / 14) + 30% × deadline proximity factor
- **Thresholds**: < 40 = at risk, 40–74 = building, ≥ 75 = strong

### `calculateOptimalNudgeTime(userEvents)`
- **Input**: All `AnalyticsEvent[]` for a user
- **Output**: `{ hour: number, dayOfWeek: number }`
- **Algorithm**: Groups `checkin_completed` events by (hour, dayOfWeek), returns the combo with the highest frequency
- **Default**: `{ hour: 8, dayOfWeek: 1 }` (8am Monday) if fewer than 10 check-in events

### `predictCompletionDate(goal, recentEvents)`
- **Input**: `Goal` + `AnalyticsEvent[]`
- **Output**: `{ date: Date, confidence: 'high'|'medium'|'low', daysAheadOrBehind: number }`
- **Algorithm**: Calculates 14-day average daily check-in rate, projects remaining progress forward
- **Confidence**: `high` ≥14 events, `medium` 5–13, `low` <5

### `calculatePeerEffectIndex(userId, goals)`
- **Input**: `string` userId + `Goal[]`
- **Output**: `number` ratio (default 1.0)
- **Algorithm**: `avg(groupGoalCompletionRate) / avg(soloGoalCompletionRate)`
- **Interpretation**: > 1.2 = groups significantly better for this user; < 0.8 = solo is better

### `generateCoachingInsights(userData)`
- **Input**: `UserAnalytics` composite object
- **Output**: `CoachingInsight[]` — exactly 4 items
- **Order**: positive → warning → advice → prediction
- **Bullet rules**: each ≤80 chars, references real user data, starts with "You" or action verb

---

## Data Presentation Principles

All stats UI components apply these 8 rules:

1. **Every number has a plain-English label** — never show a bare number
2. **Every chart has a one-sentence takeaway** pinned below it
3. **Max 2 colors per chart**: teal (`#1D9E75`) positive, coral/amber (`#D85A30`/`#EF9F27`) negative
4. **Empty states show ghost/skeleton** with sample data (never blank)
5. **All numbers animate count-up** on screen entry (600ms ease-out)
6. **Tooltips on every chart element** showing exact value + date
7. **Three zoom levels**: Glance (home GlanceBar) → Goal level (MomentumBars, PredictionCard) → Deep Analytics tab
8. **No chart requires interpretation** — the label and caption do that job

---

## Integration Guide

### Add GlanceBar + CoachingCardsStrip to the dashboard
```tsx
// In your dashboard page or component:
import GlanceBar from '@/components/GlanceBar'
import CoachingCardsStrip from '@/components/CoachingCardsStrip'

// Both are self-fetching 'use client' components:
<GlanceBar />
<CoachingCardsStrip />
```

### Use PredictionCard inside a goal detail
```tsx
import PredictionCard from '@/components/PredictionCard'

<PredictionCard
  goalTitle={goal.title}
  targetDate={goal.endDate.toISOString()}
  predictedDate={prediction.date.toISOString()}
  daysAheadOrBehind={prediction.daysAheadOrBehind}
  confidence={prediction.confidence}
  currentProgress={Math.round((goal.currentValue / goal.targetValue) * 100)}
/>
```

### Server-side: schedule nudges from a cron route
```ts
// src/app/api/cron/nudges/route.ts
import { scheduleUserNudge } from '@/services/nudgeScheduler'

export async function POST() {
  const userIds = await getAllActiveUserIds()
  await Promise.allSettled(userIds.map(scheduleUserNudge))
  return Response.json({ ok: true })
}
```

---

## Data Retention & Privacy

- `analytics_events` rows are indexed by `userId`, `eventType`, and `occurredAt`
- Events are used only for in-product analytics (momentum, nudges, coaching)
- No events are shared externally or used for advertising
- Account deletion cascades to all event rows (`onDelete: "cascade"`)
- `noteText` in `checkin_completed` is optional and user-controlled
- Events older than 365 days may be pruned (pending retention policy)
