'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface CoachTipTooltipProps {
  tipNumber: number
  totalTips: number
  title: string
  body: string
  storageKey: string
  onDismiss?: () => void
}

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="8" stroke="#7F77DD" strokeWidth="1.5" />
      <line x1="9" y1="8" x2="9" y2="13" stroke="#7F77DD" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="9" cy="5.5" r="0.75" fill="#7F77DD" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#8C857D" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <line x1="1" y1="1" x2="13" y2="13" />
      <line x1="13" y1="1" x2="1" y2="13" />
    </svg>
  )
}

export default function CoachTipTooltip({
  tipNumber, totalTips, title, body, storageKey, onDismiss,
}: CoachTipTooltipProps) {
  const storageId = `dismissed_tip_${storageKey}`
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(storageId)) setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [storageId])

  function dismiss() {
    setDismissed(true)
    try { localStorage.setItem(storageId, '1') } catch { /* ignore */ }
    onDismiss?.()
  }

  const pct = totalTips > 0 ? (tipNumber / totalTips) * 100 : 0

  if (!visible) return null

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          key="tip"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="rounded-xl border p-3"
          style={{ backgroundColor: '#EEEDFE', borderColor: '#C4C1F9' }}
          role="status"
          aria-live="polite"
        >
          {/* Progress bar */}
          <div className="rounded-full overflow-hidden mb-2" style={{ height: 3, backgroundColor: 'rgb(var(--cream-dark-rgb))' }} aria-hidden>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: '#7F77DD' }} />
          </div>
          <p className="text-ink-muted mb-2" style={{ fontSize: 11 }}>{tipNumber} of {totalTips}</p>

          {/* Title row */}
          <div className="flex items-start gap-2 mb-2">
            <div className="flex-shrink-0 mt-px"><InfoIcon /></div>
            <span className="flex-1 font-medium text-ink" style={{ fontSize: 13 }}>{title}</span>
            <button
              type="button" onClick={dismiss} aria-label="Dismiss tip"
              className="flex-shrink-0 inline-flex items-center justify-center rounded-lg hover:bg-white/50 transition-colors"
              style={{ width: 32, height: 32, minWidth: 32 }}
            >
              <CloseIcon />
            </button>
          </div>

          {/* Body */}
          <p className="text-ink-soft leading-relaxed mb-3" style={{ fontSize: 13 }}>{body}</p>

          {/* Got it */}
          <button
            type="button" onClick={dismiss}
            className="inline-flex items-center rounded-lg border border-cream-dark text-ink-muted hover:text-ink transition-colors"
            style={{ fontSize: 11, minHeight: 44, paddingLeft: 12, paddingRight: 12 }}
          >
            Got it
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
