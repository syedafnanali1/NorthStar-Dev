'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type NotificationType = 'streak' | 'behind' | 'peer' | 'celebration' | 'weekly'

interface PushNotificationProps {
  type: NotificationType
  goalName: string
  message: string
  timestamp: string
  isVisible: boolean
  onDismiss: () => void
}

const TYPE_CONFIG: Record<NotificationType, { iconStroke: string; bg: string; title: string }> = {
  streak:      { iconStroke: '#1D9E75', bg: '#E1F5EE', title: 'Streak reminder' },
  behind:      { iconStroke: '#D85A30', bg: '#FAECE7', title: 'Goal behind' },
  peer:        { iconStroke: '#7F77DD', bg: '#EEEDFE', title: 'Peer activity' },
  celebration: { iconStroke: '#EF9F27', bg: '#FAEEDA', title: 'Goal complete' },
  weekly:      { iconStroke: '#378ADD', bg: '#E6F1FB', title: 'Weekly summary' },
}

function StreakIcon({ s }: { s: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="9" stroke={s} strokeWidth="1.5" />
      <path d="M5.5 10L8.5 13L14.5 7" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BehindIcon({ s }: { s: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="9" stroke={s} strokeWidth="1.5" />
      <path d="M10 5.5V10.5L13.5 12.5" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function PeerIcon({ s }: { s: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="7" r="3.5" stroke={s} strokeWidth="1.5" />
      <path d="M3 18c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function CelebrationIcon({ s }: { s: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 2l2.09 6.26H18l-5.14 3.73 1.96 6.01L10 14.27l-4.82 3.73 1.96-6.01L2 8.26h5.91L10 2z" stroke={s} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function WeeklyIcon({ s }: { s: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2" y="11" width="4" height="7" rx="1" stroke={s} strokeWidth="1.5" />
      <rect x="8" y="6" width="4" height="12" rx="1" stroke={s} strokeWidth="1.5" />
      <rect x="14" y="3" width="4" height="15" rx="1" stroke={s} strokeWidth="1.5" />
    </svg>
  )
}

function NotificationIcon({ type, stroke }: { type: NotificationType; stroke: string }) {
  switch (type) {
    case 'streak':      return <StreakIcon s={stroke} />
    case 'behind':      return <BehindIcon s={stroke} />
    case 'peer':        return <PeerIcon s={stroke} />
    case 'celebration': return <CelebrationIcon s={stroke} />
    case 'weekly':      return <WeeklyIcon s={stroke} />
  }
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#8C857D" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <line x1="1" y1="1" x2="13" y2="13" />
      <line x1="13" y1="1" x2="1" y2="13" />
    </svg>
  )
}

export default function PushNotification({ type, message, timestamp, isVisible, onDismiss }: PushNotificationProps) {
  const cfg = TYPE_CONFIG[type]
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isVisible) return
    timerRef.current = setTimeout(onDismiss, 4000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [isVisible, onDismiss])

  const truncatedMessage = message.length > 55 ? message.slice(0, 55) + '…' : message

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1, transition: { type: 'spring', damping: 20, stiffness: 180 } }}
          exit={{ y: -80, opacity: 0, transition: { duration: 0.25 } }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          onDragEnd={(_, info) => {
            if (info.offset.y < -40 || info.velocity.y < -300) onDismiss()
          }}
          className="fixed top-4 left-4 right-4 z-[9999] mx-auto max-w-[400px] rounded-[14px] bg-white shadow-modal"
          style={{ border: '0.5px solid rgba(26,23,20,0.1)' }}
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-center gap-3 px-3 py-3">
            {/* Icon circle */}
            <div
              className="inline-flex items-center justify-center flex-shrink-0 rounded-full"
              style={{ width: 38, height: 38, backgroundColor: cfg.bg }}
            >
              <NotificationIcon type={type} stroke={cfg.iconStroke} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink truncate" style={{ fontSize: 13 }}>{cfg.title}</span>
                <span className="text-ink-muted flex-shrink-0 ml-auto" style={{ fontSize: 11 }}>{timestamp}</span>
              </div>
              <p className="text-ink-soft line-clamp-2 mt-0.5" style={{ fontSize: 13 }}>{truncatedMessage}</p>
            </div>

            {/* Dismiss */}
            <button
              type="button" onClick={onDismiss} aria-label="Dismiss notification"
              className="flex-shrink-0 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              style={{ width: 32, height: 32, minWidth: 32 }}
            >
              <CloseIcon />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
