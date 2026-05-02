'use client'

import { motion } from 'framer-motion'

const AVATAR_BG = ['#E1F5EE', '#EEEDFE', '#FAEEDA'] as const
const AVATAR_TEXT = ['#085041', '#3C3489', '#633806'] as const

interface Member {
  id: string
  name: string
  avatarUrl?: string
  checkedIn: boolean
}

interface GroupAccountabilityCardProps {
  goalName: string
  members: Member[]
  totalMembers: number
  userCheckedIn: boolean
  onCheckIn?: () => void
  onSendCheer?: () => void
  className?: string
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase()
}

function ThumbsUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M5 7V13H2V7h3zM5 7l2.5-4.5a1.5 1.5 0 013 .5V5h3.5l-1 7H5V7z" />
    </svg>
  )
}

function AvatarStack({ members }: { members: Member[] }) {
  const visible = members.slice(0, 5)
  const overflow = members.length - 5
  return (
    <div className="flex items-center">
      {visible.map((m, i) => (
        <div
          key={m.id}
          className="relative inline-flex items-center justify-center overflow-hidden rounded-full font-bold"
          style={{
            width: 28, height: 28,
            border: '1.5px solid white',
            marginLeft: i === 0 ? 0 : -8,
            zIndex: visible.length - i,
            backgroundColor: AVATAR_BG[i % 3],
            color: AVATAR_TEXT[i % 3],
            fontSize: 10, flexShrink: 0,
          }}
          title={m.name}
        >
          {m.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={m.avatarUrl} alt={m.name} className="h-full w-full object-cover" />
            : initials(m.name)
          }
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="relative inline-flex items-center justify-center rounded-full font-semibold"
          style={{ width: 28, height: 28, border: '1.5px solid white', marginLeft: -8, backgroundColor: 'rgb(var(--cream-dark-rgb))', color: 'rgb(var(--ink-muted-rgb))', fontSize: 10, flexShrink: 0 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}

export default function GroupAccountabilityCard({
  goalName, members, totalMembers, userCheckedIn, onCheckIn, onSendCheer, className,
}: GroupAccountabilityCardProps) {
  const checkedInCount = members.filter((m) => m.checkedIn).length
  const progressPct = totalMembers > 0 ? (checkedInCount / totalMembers) * 100 : 0

  return (
    <div className={`rounded-2xl border border-cream-dark bg-white p-4 shadow-card ${className ?? ''}`.trim()}>
      {/* Row 1 */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="font-medium text-ink truncate" style={{ fontSize: 14 }}>{goalName}</span>
        <span className="inline-flex items-center rounded-full px-2 py-0.5 font-semibold flex-shrink-0" style={{ backgroundColor: '#E1F5EE', color: '#0F6E56', fontSize: 11 }}>
          {checkedInCount}/{totalMembers}
        </span>
      </div>

      {/* Row 2 */}
      <div className="flex items-center gap-2 mb-3">
        {members.length > 0 && <AvatarStack members={members} />}
        <span className="text-ink-muted" style={{ fontSize: 12 }}>
          {checkedInCount} member{checkedInCount !== 1 ? 's' : ''} checked in today
        </span>
      </div>

      {/* Row 3: progress bar */}
      <div
        className="rounded-full overflow-hidden mb-3"
        style={{ height: 4, backgroundColor: 'rgb(var(--cream-dark-rgb))' }}
        role="progressbar" aria-valuenow={Math.round(progressPct)} aria-valuemin={0} aria-valuemax={100}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: '#1D9E75' }}
          initial={{ width: '0%' }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      {/* Row 4: buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button" onClick={onSendCheer}
          className="inline-flex items-center gap-1.5 rounded-xl border border-cream-dark text-ink-muted hover:text-ink transition-colors"
          style={{ fontSize: 13, minHeight: 44, paddingLeft: 14, paddingRight: 14 }}
        >
          <ThumbsUp /> Send cheer
        </button>

        {userCheckedIn ? (
          <span className="inline-flex items-center gap-1 font-semibold" style={{ fontSize: 13, color: '#1D9E75', minHeight: 44 }}>
            You checked in ✓
          </span>
        ) : (
          <button
            type="button" onClick={onCheckIn}
            className="flex-1 inline-flex items-center justify-center rounded-xl font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#1D9E75', fontSize: 13, minHeight: 44 }}
          >
            Check in now
          </button>
        )}
      </div>
    </div>
  )
}
