'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'

// ── Types ─────────────────────────────────────────────────────────────
type MoodKey = 'low' | 'okay' | 'great' | 'amazing'
type SleepKey = 'under_5' | 'five_to_6' | 'six_to_7' | 'seven_to_8' | 'over_8'

interface DailyLog {
  mood: string | null
  sleep: string | null
  date: string
}

// ── Mood options ──────────────────────────────────────────────────────
const MOODS: Array<{ key: MoodKey; emoji: string; label: string; color: string }> = [
  { key: 'low',     emoji: '😔', label: 'Low',     color: '#D85A30' },
  { key: 'okay',    emoji: '😐', label: 'Okay',    color: '#EF9F27' },
  { key: 'great',   emoji: '😊', label: 'Great',   color: '#1D9E75' },
  { key: 'amazing', emoji: '🔥', label: 'Amazing', color: '#7F77DD' },
]

// ── Sleep options ─────────────────────────────────────────────────────
const SLEEP_OPTIONS: Array<{
  key: SleepKey
  emoji: string
  label: string
  tip: string
}> = [
  { key: 'under_5',    emoji: '😴', label: '<5h',  tip: 'rough night' },
  { key: 'five_to_6',  emoji: '🌙', label: '5–6h', tip: 'a bit short'  },
  { key: 'six_to_7',   emoji: '✨', label: '6–7h', tip: 'getting there' },
  { key: 'seven_to_8', emoji: '⭐', label: '7–8h', tip: 'sweet spot'   },
  { key: 'over_8',     emoji: '🌟', label: '8h+',  tip: 'excellent'    },
]

const MOOD_EMOJI: Record<string, string> = {
  low: '😔', okay: '😐', great: '😊', amazing: '🔥',
}
const SLEEP_LABEL: Record<string, string> = {
  under_5: '<5h', five_to_6: '5–6h', six_to_7: '6–7h', seven_to_8: '7–8h', over_8: '8h+',
}

// ── Component ─────────────────────────────────────────────────────────
export function DailyPulseCard() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [status, setStatus]           = useState<'loading' | 'logged' | 'pending'>('loading')
  const [existing, setExisting]       = useState<DailyLog | null>(null)
  const [expanded, setExpanded]       = useState(false)
  const [selectedMood, setSelectedMood]   = useState<MoodKey | null>(null)
  const [selectedSleep, setSelectedSleep] = useState<SleepKey | null>(null)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)

  const fetchToday = useCallback(async () => {
    try {
      const r = await fetch(`/api/daily-logs?date=${today}`)
      if (!r.ok) { setStatus('pending'); return }
      const data = await r.json() as { log?: DailyLog | null }
      if (data.log?.mood) {
        setExisting(data.log)
        setStatus('logged')
      } else {
        setStatus('pending')
      }
    } catch {
      setStatus('pending')
    }
  }, [today])

  useEffect(() => { void fetchToday() }, [fetchToday])

  async function handleSave() {
    if (!selectedMood) return
    setSaving(true)
    try {
      await fetch('/api/daily-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          mood: selectedMood,
          sleep: selectedSleep,
        }),
      })
      confetti({ particleCount: 40, spread: 55, origin: { y: 0.55 }, scalar: 0.8 })
      setSaved(true)
      setExisting({ mood: selectedMood, sleep: selectedSleep, date: today })
      await new Promise<void>((r) => setTimeout(r, 800))
      setStatus('logged')
      setExpanded(false)
    } finally {
      setSaving(false)
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div
        className="rounded-2xl border animate-pulse"
        style={{ background: 'var(--cream-paper)', borderColor: 'var(--cream-dark)', height: 72 }}
      />
    )
  }

  // ── Already logged — compact summary ─────────────────────────────
  if (status === 'logged' && existing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border px-4 py-3 flex items-center justify-between"
        style={{
          background: 'var(--cream-paper)',
          borderColor: 'var(--cream-dark)',
          borderLeft: '3px solid #1D9E75',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Pulse dot */}
          <div className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center"
            style={{ background: 'rgba(29,158,117,0.12)' }}>
            <span className="text-sm">✓</span>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--ink-muted)' }}>
              Today&apos;s Pulse
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {existing.mood && (
                <span className="text-sm font-medium flex items-center gap-1" style={{ color: 'var(--ink)' }}>
                  {MOOD_EMOJI[existing.mood] ?? '😊'}
                  <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                    {existing.mood.charAt(0).toUpperCase() + existing.mood.slice(1)}
                  </span>
                </span>
              )}
              {existing.sleep && (
                <>
                  <span style={{ color: 'var(--cream-dark)' }}>·</span>
                  <span className="text-xs flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}>
                    😴 {SLEEP_LABEL[existing.sleep]}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setStatus('pending'); setExpanded(true) }}
          className="text-[10px] font-medium flex-shrink-0 px-2.5 py-1.5 rounded-full transition-colors"
          style={{
            color: 'var(--ink-muted)',
            background: 'var(--cream)',
            border: '1px solid var(--cream-dark)',
          }}
        >
          Edit
        </button>
      </motion.div>
    )
  }

  // ── Not logged yet ────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border overflow-hidden"
      style={{
        background: 'var(--cream-paper)',
        borderColor: 'var(--cream-dark)',
        borderLeft: '3px solid var(--gold)',
      }}
    >
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors text-left"
        style={{ background: 'transparent' }}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center"
            style={{ background: 'rgba(196,150,58,0.12)' }}>
            <span className="text-sm">💭</span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--gold)' }}>
              Today&apos;s Pulse
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>
              Log mood &amp; sleep · takes 10 seconds
            </p>
          </div>
        </div>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          className="text-sm flex-shrink-0"
          style={{ color: 'var(--ink-muted)' }}
        >
          ↓
        </motion.span>
      </button>

      {/* Expanded form */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-4"
              style={{ borderTop: '1px solid var(--cream-dark)' }}
            >
              {/* Mood row */}
              <p
                className="text-[9px] font-bold uppercase tracking-[0.15em] mt-3 mb-2"
                style={{ color: 'var(--ink-muted)' }}
              >
                How are you feeling?
              </p>
              <div className="flex gap-1.5 mb-4">
                {MOODS.map((m) => {
                  const isSelected = selectedMood === m.key
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setSelectedMood(isSelected ? null : m.key)}
                      aria-pressed={isSelected}
                      aria-label={m.label}
                      className="flex-1 flex flex-col items-center gap-1 rounded-[10px] py-2 transition-all duration-150"
                      style={{
                        minHeight: 56,
                        background: isSelected ? `${m.color}15` : 'var(--cream)',
                        border: `1.5px solid ${isSelected ? m.color : 'var(--cream-dark)'}`,
                        transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                      }}
                    >
                      <span className="text-base leading-none">{m.emoji}</span>
                      <span
                        className="text-[9px] font-semibold"
                        style={{ color: isSelected ? m.color : 'var(--ink-muted)' }}
                      >
                        {m.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Sleep row */}
              <p
                className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2"
                style={{ color: 'var(--ink-muted)' }}
              >
                Last night&apos;s sleep <span style={{ textTransform: 'none', fontWeight: 400 }}>· optional</span>
              </p>
              <div className="flex gap-1 mb-4">
                {SLEEP_OPTIONS.map((s) => {
                  const isSelected = selectedSleep === s.key
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setSelectedSleep(isSelected ? null : s.key)}
                      aria-pressed={isSelected}
                      aria-label={`Sleep ${s.label}`}
                      className="flex-1 flex flex-col items-center gap-0.5 rounded-[8px] py-1.5 transition-all duration-150"
                      style={{
                        background: isSelected ? 'rgba(29,158,117,0.13)' : 'var(--cream)',
                        border: `1.5px solid ${isSelected ? '#1D9E75' : 'var(--cream-dark)'}`,
                      }}
                    >
                      <span className="text-xs leading-none">{s.emoji}</span>
                      <span
                        className="text-[8px] font-semibold"
                        style={{ color: isSelected ? '#1D9E75' : 'var(--ink-muted)' }}
                      >
                        {s.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Submit */}
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!selectedMood || saving}
                className="w-full rounded-[10px] text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                style={{
                  minHeight: 44,
                  background: selectedMood ? '#1D9E75' : 'var(--cream-dark)',
                  color: selectedMood ? '#fff' : 'var(--ink-muted)',
                  opacity: saving ? 0.8 : 1,
                  cursor: selectedMood ? 'pointer' : 'not-allowed',
                }}
              >
                {saving ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="animate-spin">
                      <circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
                      <path d="M7 1.5 A5.5 5.5 0 0 1 12.5 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <span>Saving…</span>
                  </>
                ) : saved ? (
                  '✓ Saved!'
                ) : (
                  'Save today\'s pulse'
                )}
              </button>

              {!selectedMood && (
                <p className="text-center text-[9px] mt-1.5" style={{ color: 'var(--ink-muted)' }}>
                  Pick a mood to continue
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
