'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { format } from 'date-fns'

// ── Types ──────────────────────────────────────────────────────────────
type MoodKey = 'low' | 'okay' | 'great' | 'amazing'
type SleepKey = 'under_5' | 'five_to_6' | 'six_to_7' | 'seven_to_8' | 'over_8'

interface DailyCheckinSheetProps {
  isOpen: boolean
  goalName: string
  weekLabel: string
  goalId: string
  onClose: () => void
  onSubmit?: (data: { mood: string; note: string; sleep: string | null }) => void
}

// ── Mood config ───────────────────────────────────────────────────────
interface MoodOption {
  key: MoodKey
  label: string
  emoji: string
  accentColor: string
  bgLight: string
  bgDark: string
}

const MOODS: MoodOption[] = [
  {
    key: 'low',
    label: 'Low',
    emoji: '😔',
    accentColor: '#D85A30',
    bgLight: '#FAECE7',
    bgDark: 'rgba(216,90,48,0.15)',
  },
  {
    key: 'okay',
    label: 'Okay',
    emoji: '😐',
    accentColor: '#EF9F27',
    bgLight: '#FAEEDA',
    bgDark: 'rgba(239,159,39,0.15)',
  },
  {
    key: 'great',
    label: 'Great',
    emoji: '😊',
    accentColor: '#1D9E75',
    bgLight: '#E1F5EE',
    bgDark: 'rgba(29,158,117,0.18)',
  },
  {
    key: 'amazing',
    label: 'Amazing',
    emoji: '🔥',
    accentColor: '#7F77DD',
    bgLight: '#EEEDFE',
    bgDark: 'rgba(127,119,221,0.18)',
  },
]

// ── Sleep config ──────────────────────────────────────────────────────
interface SleepOption {
  key: SleepKey
  label: string
  emoji: string
  quality: 'poor' | 'ok' | 'good' | 'great'
}

const SLEEP_OPTIONS: SleepOption[] = [
  { key: 'under_5', label: '<5h',    emoji: '😴', quality: 'poor'  },
  { key: 'five_to_6',  label: '5–6h',  emoji: '🌙', quality: 'ok'   },
  { key: 'six_to_7',   label: '6–7h',  emoji: '✨', quality: 'good'  },
  { key: 'seven_to_8', label: '7–8h',  emoji: '⭐', quality: 'great' },
  { key: 'over_8',     label: '8h+',   emoji: '🌟', quality: 'great' },
]

const SLEEP_QUALITY_COLOR: Record<SleepOption['quality'], string> = {
  poor:  '#D85A30',
  ok:    '#EF9F27',
  good:  '#1D9E75',
  great: '#1D9E75',
}

// ── Mood face SVG ─────────────────────────────────────────────────────
function MoodFace({ moodKey, color }: { moodKey: MoodKey; color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10.5" stroke={color} strokeWidth="1.5" fill="none" />
      <circle cx="9" cy="10" r="1.3" fill={color} />
      <circle cx="15" cy="10" r="1.3" fill={color} />
      {moodKey === 'low' && (
        <path d="M 8,16 Q 12,13 16,16" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      )}
      {moodKey === 'okay' && (
        <line x1="8" y1="15" x2="16" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      )}
      {moodKey === 'great' && (
        <path d="M 8,14 Q 12,18 16,14" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      )}
      {moodKey === 'amazing' && (
        <>
          <path d="M 7,13 Q 12,19 17,13" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M 8,8 Q 10,6 12,8" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" />
          <path d="M 12,8 Q 14,6 16,8" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" />
        </>
      )}
    </svg>
  )
}

// ── Loading spinner ───────────────────────────────────────────────────
function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="animate-spin">
      <circle cx="9" cy="9" r="7" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
      <path d="M9 2 A7 7 0 0 1 16 9" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────
export default function DailyCheckinSheet({
  isOpen,
  goalName,
  weekLabel,
  onClose,
  onSubmit,
}: DailyCheckinSheetProps) {
  const [selectedMood, setSelectedMood] = React.useState<MoodKey | null>(null)
  const [selectedSleep, setSelectedSleep] = React.useState<SleepKey | null>(null)
  const [note, setNote] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  // Reset on open
  React.useEffect(() => {
    if (isOpen) {
      setSelectedMood(null)
      setSelectedSleep(null)
      setNote('')
      setLoading(false)
    }
  }, [isOpen])

  const canSubmit = !!selectedMood

  async function handleSubmit() {
    if (!canSubmit) return
    setLoading(true)

    const today = format(new Date(), 'yyyy-MM-dd')

    try {
      // POST to /api/daily-logs — includes mood, sleep, and note (as reflection)
      await fetch('/api/daily-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          mood: selectedMood,
          sleep: selectedSleep,
          reflection: note.trim() || undefined,
        }),
      })

      // Confetti burst
      confetti({ particleCount: 55, spread: 65, origin: { y: 0.65 } })

      onSubmit?.({ mood: selectedMood!, note, sleep: selectedSleep })

      await new Promise<void>((r) => setTimeout(r, 500))
      onClose()
    } catch {
      // still close on failure so UX isn't stuck
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="checkin-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
            <motion.div
              key="checkin-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={`Daily check-in for ${goalName}`}
              initial={{ y: 320, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 320, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 160 }}
              className="relative pointer-events-auto w-full rounded-t-[20px]"
              style={{
                maxWidth: 'min(calc(100vw - 0px), 420px)',
                background: 'var(--cream-paper)',
                borderTop: '1px solid var(--cream-dark)',
                paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
              }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div
                  className="w-9 h-[4px] rounded-full cursor-pointer"
                  style={{ background: 'var(--cream-dark)' }}
                  onClick={onClose}
                  role="button"
                  aria-label="Close"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onClose()}
                />
              </div>

              <div className="px-5 pt-2 pb-2">
                {/* Goal header */}
                <div className="mb-5">
                  <p
                    className="text-xs font-semibold uppercase tracking-widest mb-0.5"
                    style={{ color: 'var(--ink-muted)', letterSpacing: '0.13em' }}
                  >
                    Check-in
                  </p>
                  <p className="font-serif text-base font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
                    {goalName}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>
                    {weekLabel}
                  </p>
                </div>

                {/* ── Mood section ─────────────────────────────── */}
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2.5"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  How are you feeling?
                </p>
                <div className="grid grid-cols-4 gap-2 mb-5">
                  {MOODS.map((mood) => {
                    const isSelected = selectedMood === mood.key
                    return (
                      <button
                        key={mood.key}
                        type="button"
                        onClick={() => setSelectedMood(mood.key)}
                        aria-pressed={isSelected}
                        aria-label={`${mood.label} mood`}
                        className="flex flex-col items-center gap-1.5 rounded-[12px] py-2.5 transition-all duration-150"
                        style={{
                          minHeight: 72,
                          background: isSelected ? mood.bgLight : 'var(--cream)',
                          border: `1.5px solid ${isSelected ? mood.accentColor : 'var(--cream-dark)'}`,
                          transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                        }}
                      >
                        {/* dark mode override for bg */}
                        <style>{`.dark .mood-${mood.key}-selected { background: ${mood.bgDark} !important; }`}</style>
                        <MoodFace moodKey={mood.key} color={mood.accentColor} />
                        <span
                          className="text-[10px] font-semibold"
                          style={{ color: isSelected ? mood.accentColor : 'var(--ink-muted)' }}
                        >
                          {mood.label}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* ── Sleep section ─────────────────────────────── */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2.5">
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.15em]"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      Last night&apos;s sleep
                    </p>
                    <span className="text-[10px]" style={{ color: 'var(--ink-muted)' }}>
                      optional
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {SLEEP_OPTIONS.map((opt) => {
                      const isSelected = selectedSleep === opt.key
                      const accent = SLEEP_QUALITY_COLOR[opt.quality]
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setSelectedSleep(isSelected ? null : opt.key)}
                          aria-pressed={isSelected}
                          aria-label={`Sleep ${opt.label}`}
                          className="flex-1 flex flex-col items-center gap-1 rounded-[10px] py-2 transition-all duration-150"
                          style={{
                            background: isSelected ? `${accent}18` : 'var(--cream)',
                            border: `1.5px solid ${isSelected ? accent : 'var(--cream-dark)'}`,
                            minHeight: 52,
                          }}
                        >
                          <span className="text-sm leading-none">{opt.emoji}</span>
                          <span
                            className="text-[9px] font-semibold"
                            style={{ color: isSelected ? accent : 'var(--ink-muted)' }}
                          >
                            {opt.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {selectedSleep && (
                    <motion.p
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-1.5 text-[10px]"
                      style={{ color: SLEEP_QUALITY_COLOR[SLEEP_OPTIONS.find(s => s.key === selectedSleep)!.quality] }}
                    >
                      {selectedSleep === 'under_5' && '😴 Rough night — be kind to yourself today.'}
                      {selectedSleep === 'five_to_6' && '🌙 A bit short — try to rest tonight.'}
                      {selectedSleep === 'six_to_7' && '✨ Getting there — consistency matters.'}
                      {selectedSleep === 'seven_to_8' && '⭐ Great — the sweet spot for performance.'}
                      {selectedSleep === 'over_8' && '🌟 Excellent — your body got the rest it needed.'}
                    </motion.p>
                  )}
                </div>

                {/* ── Note ─────────────────────────────────────── */}
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note... (optional)"
                  rows={2}
                  maxLength={280}
                  className="w-full rounded-[12px] p-3 text-sm resize-none transition-colors"
                  style={{
                    background: 'var(--cream)',
                    border: '1.5px solid var(--cream-dark)',
                    color: 'var(--ink)',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />

                {/* ── Submit ───────────────────────────────────── */}
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit || loading}
                  className="w-full rounded-[12px] font-semibold text-sm flex items-center justify-center gap-2 mt-3 transition-all"
                  style={{
                    minHeight: 48,
                    background: canSubmit ? '#1D9E75' : 'var(--cream-dark)',
                    color: canSubmit ? '#fff' : 'var(--ink-muted)',
                    opacity: loading ? 0.8 : 1,
                    cursor: canSubmit ? 'pointer' : 'not-allowed',
                  }}
                >
                  {loading ? (
                    <>
                      <Spinner />
                      <span>Logging…</span>
                    </>
                  ) : (
                    <>
                      <span>✓</span>
                      <span>Log check-in</span>
                    </>
                  )}
                </button>

                {/* Mood required hint */}
                {!selectedMood && (
                  <p className="mt-2 text-center text-[10px]" style={{ color: 'var(--ink-muted)' }}>
                    Select a mood to continue
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
