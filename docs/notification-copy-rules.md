# Notification & Coaching Card Copy Rules

## Overview

All notification copy must be specific, data-driven, and concise. Generic motivational phrases are prohibited. Every notification names a real goal, references a real number, or names a real person.

---

## Notification Copy Rules

### Hard limits
- **Body**: max 60 characters (truncated with `…` if exceeded)
- **Title**: max 30 characters
- **No exclamation marks** in title or body — except `celebration` type
- **No emoji** in notification title
- **No generic phrases**: never use "Don't forget!", "Stay motivated!", "Keep it up!" (these say nothing)

### Templates

| Type | Title | Body template | Example |
|---|---|---|---|
| `streak_protect` | `"Streak at risk"` | `"{goalName}: {n}-day streak — 1 check-in saves it"` | `"Spanish: 14-day streak — 1 check-in saves it"` |
| `behind` | `"{goalName}"` | `"{goalName}: {n} days without a check-in. One step helps."` | `"Exercise: 4 days without a check-in. One step helps."` |
| `peer` | `"Your group is active"` | `"{memberName} checked in on {goalName}. You're up."` | `"Alex checked in on Read Daily. You're up."` |
| `celebration` | `"Goal complete!"` | `"You completed {goalName} — {n} days, {c} check-ins."` | `"You completed Spanish — 90 days, 62 check-ins."` |
| `weekly` | `"Your week in numbers"` | `"Your week: {n} check-ins, {r}% completion."` | `"Your week: 12 check-ins, 71% completion."` |

### Variables

| Variable | Description |
|---|---|
| `{goalName}` | Exact title of the goal (truncate to 20 chars if needed) |
| `{n}` | Number (days missed, streak length, check-in count) |
| `{c}` | Count of check-ins to complete the goal |
| `{r}` | Completion rate as integer percentage |
| `{memberName}` | First name or full name of the peer |

---

## Priority Queue Logic

The scheduler sends **max 1 goal reminder per day per user**. Priority order:

1. **At-risk goals** — deadline ≤ 14 days AND progress < 40%
2. **Goals with today's intentions** — user set a scheduled intention for today
3. **Streak protection** — streak ≥ 3 AND user hasn't checked in today (fires at 10pm)
4. **General check-in** — any active goal that hasn't been checked in today

**Peer nudge** is independent: fires at most 1× per day if ≥2 group members checked in and the user hasn't.

**Weekly insights** fires every Sunday at `optimalNudgeHour`.

### Quiet hours
Never send between **10pm–7am** (22:00–07:00 local time).

---

## Coaching Card Formatting Rules

### Card title
- 3–5 words, sentence case (first word capitalized, rest lowercase)
- No punctuation at end
- Describes the theme, not an instruction
- ✅ `"What you are doing well"`
- ❌ `"Great job! Keep it up!"`

### Bullets
- Exactly 2–4 per card
- Each bullet ≤ 80 characters
- Must reference a **real data point** (not generic advice)
- Starts with `"You"` or an action verb
- One sentence only — no sub-clauses
- No emojis, no hashtags, no motivational jargon

### Card types and their meaning
| Type | Color | Theme |
|---|---|---|
| `positive` | Green (teal) | What's going well, strengths to build on |
| `warning` | Coral/red | Slippage, missed patterns, risk signals |
| `advice` | Purple | Concrete changes to make, tactical suggestions |
| `prediction` | Blue | Forecast, projections, what happens next |

---

## Good Bullet Examples

### Positive (start with "You" or state a fact)
- `"You check in most on Tuesday mornings — protect that slot."`
- `"Read Daily has 91% completion this month — your best goal."`
- `"Your streak is the longest you've ever had."`
- `"You completed 4 of 5 goals last month — above your average."`
- `"Your check-in rate doubled this week compared to last week."`

### Warning (name the specific gap)
- `"Exercise has missed 4 of 6 check-ins this fortnight."`
- `"Spanish is 8 days behind its planned pace."`
- `"You haven't opened the app on any Wednesday this month."`
- `"Your 3pm check-ins have a 28% completion rate — your weakest slot."`

### Advice (action verbs, specific)
- `"Break your 60-min gym goal into two 30-min sessions."`
- `"Move Spanish to 8am — that's when you complete most goals."`
- `"Set a Wednesday intention — you have zero mid-week check-ins."`
- `"Cap your daily intentions at 3 — overloaded days stall 55% of the time."`

### Prediction (data-driven projections)
- `"At current pace, Spanish finishes 3 months late."`
- `"Add 2 check-ins/week to hit your December deadline."`
- `"Group goals complete 34% faster for you — invite someone."`
- `"At this pace you will complete 4 goals by end of month."`

---

## Anti-Examples — Never Write These

| ❌ Bad | Why it's bad |
|---|---|
| `"Don't forget to check in today!"` | Generic, references no specific goal |
| `"You're doing great — keep it up!"` | Vague praise, no data |
| `"Stay motivated!"` | Means nothing, doesn't help |
| `"Try to be more consistent."` | Advice without specifics |
| `"You're almost there!"` | Which goal? What percentage? |
| `"Great job this week!"` | Which metric improved? |
| `"Remember: consistency is key."` | A platitude, not coaching |

---

## Regeneration Rules

- Coaching cards regenerate **once per day** using fresh algorithm output
- No bullet should appear **two days in a row** (compare against previous day's bullets)
- Cache in localStorage for 24 hours from `generatedAt` timestamp
- Refresh on app foreground (`visibilitychange` event)
- Stale after 24 hours — force re-fetch on next open
