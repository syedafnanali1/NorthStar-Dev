'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'

interface DailyCheckinSheetProps {
  isOpen: boolean
  goalName: string
  weekLabel: string
  goalId: string
  onClose: () => void
  onSubmit?: (data: { mood: string; note: string }) => void
}

type MoodKey = 'low' | 'okay' | 'great' | 'amazing'

interface MoodOption {
  key: MoodKey
  label: string
  colors: { bg: string; border: string; text: string }
}

const MOODS: MoodOption[] = [
  {
    key: 'low',
    label: 'Low',
    colors: { bg: '#FAECE7', border: '#D85A30', text: '#712B13' },
  },
  {
    key: 'okay',
    label: 'Okay',
    colors: { bg: '#FAEEDA', border: '#EF9F27', text: '#633806' },
  },
  {
    key: 'great',
    label: 'Great',
    colors: { bg: '#E1F5EE', border: '#1D9E75', text: '#085041' },
  },
  {
    key: 'amazing',
    label: 'Amazing',
    colors: { bg: '#EEEDFE', border: '#7F77DD', text: '#3C3489' },
  },
]

function MoodFace({ moodKey }: { moodKey: MoodKey }) {
  const strokeMap: Record<MoodKey, string> = {
    low: '#D85A30',
    okay: '#EF9F27',
    great: '#1D9E75',
    amazing: '#7F77DD',
  }
  const stroke = strokeMap[moodKey]

  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Face circle */}
      <circle cx="11" cy="11" r="10" stroke={stroke} strokeWidth="1.5" fill="none" />

      {/* Eyes */}
      <circle cx="8" cy="9" r="1.2" fill={stroke} />
      <circle cx="14" cy="9" r="1.2" fill={stroke} />

      {/* Mouth based on mood */}
      {moodKey === 'low' && (
        // Downward curve
        <path d="M 7,14 Q 11,11 15,14" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      )}
      {moodKey === 'okay' && (
        // Flat line
        <line x1="7" y1="13" x2="15" y2="13" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      )}
      {moodKey === 'great' && (
        // Upward smile
        <path d="M 7,13 Q 11,16 15,13" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      )}
      {moodKey === 'amazing' && (
        <>
          {/* Big smile */}
          <path d="M 6,12 Q 11,18 16,12" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" fill="none" />
          {/* Raised brows */}
          <path d="M 7,7 Q 9,5 11,7" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" fill="none" />
          <path d="M 11,7 Q 13,5 15,7" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" fill="none" />
        </>
      )}
    </svg>
  )
}

function LoadingSpinner() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="animate-spin"
    >
      <circle cx="10" cy="10" r="8" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
      <path
        d="M10 2 A8 8 0 0 1 18 10"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function DailyCheckinSheet({
  isOpen,
  goalName,
  weekLabel,
  onClose,
  onSubmit,
}: DailyCheckinSheetProps) {
  const [selectedMood, setSelectedMood] = React.useState<MoodKey | null>(null)
  const [note, setNote] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  // Reset state when sheet opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedMood(null)
      setNote('')
      setLoading(false)
    }
  }, [isOpen])

  async function handleSubmit() {
    if (!selectedMood) return
    setLoading(true)

    try {
      onSubmit?.({ mood: selectedMood, note })

      // Confetti burst
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } })

      // Brief pause for visual feedback
      await new Promise<void>((resolve) => setTimeout(resolve, 600))
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
            className="fixed inset-0 bg-black/40 z-40"
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
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 160 }}
              className="relative bg-white rounded-t-[20px] rounded-b-[16px] pointer-events-auto w-full pb-6"
              style={{ maxWidth: 'min(calc(100vw - 32px), 400px)' }}
            >
              {/* Handle bar */}
              <div
                className="w-9 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-4 cursor-pointer"
                onClick={onClose}
                role="button"
                aria-label="Close"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onClose()}
              />

              <div className="px-5">
                {/* Goal name + week label */}
                <div className="mb-4">
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>
                    {goalName}
                  </div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                    {weekLabel}
                  </div>
                </div>

                {/* "How are you feeling?" label */}
                <div
                  className="uppercase mb-2"
                  style={{ fontSize: 11, color: '#9CA3AF', letterSpacing: '0.05em' }}
                >
                  How are you feeling?
                </div>

                {/* Mood grid */}
                <div className="grid grid-cols-4 gap-2">
                  {MOODS.map((mood) => {
                    const isSelected = selectedMood === mood.key
                    return (
                      <button
                        key={mood.key}
                        type="button"
                        onClick={() => setSelectedMood(mood.key)}
                        className="rounded-[10px] p-2 flex flex-col items-center gap-1 cursor-pointer transition-all"
                        style={{
                          minHeight: 44,
                          minWidth: 44,
                          backgroundColor: isSelected ? mood.colors.bg : '#F9FAFB',
                          border: `1px solid ${isSelected ? mood.colors.border : '#E5E7EB'}`,
                        }}
                        aria-pressed={isSelected}
                        aria-label={mood.label}
                      >
                        <MoodFace moodKey={mood.key} />
                        <span
                          style={{
                            fontSize: 10,
                            color: isSelected ? mood.colors.text : '#6B7280',
                            fontWeight: isSelected ? 600 : 400,
                          }}
                        >
                          {mood.label}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Optional note textarea */}
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note..."
                  rows={3}
                  className="bg-gray-50 rounded-[10px] p-3 text-sm w-full mt-3 resize-none border border-gray-200 focus:outline-none focus:border-gray-300"
                  style={{ color: '#111827' }}
                />

                {/* Submit button */}
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={!selectedMood || loading}
                  className="min-h-[44px] w-full rounded-[10px] font-medium text-sm text-white flex items-center justify-center mt-3 transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: '#1D9E75' }}
                >
                  {loading ? (
                    <>
                      <LoadingSpinner />
                      <span className="ml-2">Logging...</span>
                    </>
                  ) : (
                    'Log check-in'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
