'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'framer-motion'

const PALETTE = {
  positive:   { bg: '#E1F5EE', dot: '#1D9E75', text: '#085041', btn: '#1D9E75' },
  warning:    { bg: '#FAECE7', dot: '#D85A30', text: '#712B13', btn: '#D85A30' },
  advice:     { bg: '#EEEDFE', dot: '#7F77DD', text: '#3C3489', btn: '#7F77DD' },
  prediction: { bg: '#E6F1FB', dot: '#378ADD', text: '#0C447C', btn: '#378ADD' },
} as const

type InsightType = 'positive' | 'warning' | 'advice' | 'prediction'

interface CoachingInsight {
  type: InsightType
  title: string
  bullets: string[]
  cta: { label: string; action: string }
  generatedAt: string
}

interface RankedInsight {
  id: string
  type: 'at_risk' | 'streak_risk' | 'momentum_spike' | 'intention_gap' | 'completion_close' | 'nudge'
  title: string
  body: string
  ctaLabel?: string
  ctaHref?: string
}

interface InsightsResponse {
  insights: RankedInsight[]
  generatedAt: string
}

const API_TYPE_MAP: Record<RankedInsight['type'], InsightType> = {
  at_risk:          'warning',
  streak_risk:      'warning',
  momentum_spike:   'positive',
  intention_gap:    'advice',
  completion_close: 'positive',
  nudge:            'advice',
}

const SECOND_BULLET: Record<InsightType, string> = {
  positive:   'Keep this momentum — consistency compounds over time.',
  warning:    'Breaking the pattern now is easier than catching up later.',
  advice:     'Small deliberate actions close the gap faster than bursts.',
  prediction: 'Adjust your plan now based on your recent pace.',
}

const CACHE_KEY = 'coaching_insights_cache'

function mapInsights(data: InsightsResponse): CoachingInsight[] {
  return data.insights.map((r) => {
    const type = API_TYPE_MAP[r.type] ?? 'advice'
    return {
      type,
      title: r.title,
      bullets: [r.body.slice(0, 80), SECOND_BULLET[type]],
      cta: { label: r.ctaLabel ?? 'View details', action: r.ctaHref ?? '/' },
      generatedAt: data.generatedAt,
    }
  })
}

const PLACEHOLDER: CoachingInsight = {
  type: 'advice',
  title: 'Keep going',
  bullets: ['Insights appear after 3+ check-ins.', 'Log your first progress entry to unlock coaching.'],
  cta: { label: 'Log progress', action: '/calendar' },
  generatedAt: new Date().toISOString(),
}

function padToFour(cards: CoachingInsight[]): CoachingInsight[] {
  const out = [...cards]
  while (out.length < 4) out.push(PLACEHOLDER)
  return out.slice(0, 4)
}

function ChevronRight({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 14 14" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform 200ms ease', transform: expanded ? 'rotate(90deg)' : 'none', flexShrink: 0 }}
      aria-hidden
    >
      <polyline points="5 2 10 7 5 12" />
    </svg>
  )
}

function CoachingCard({ card, expanded, onToggle }: { card: CoachingInsight; expanded: boolean; onToggle: () => void }) {
  const p = PALETTE[card.type]
  return (
    <div
      role="button" tabIndex={0} aria-expanded={expanded}
      onClick={onToggle}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggle()}
      className="rounded-2xl border p-4 min-w-[240px] sm:min-w-0 cursor-pointer flex-shrink-0 select-none outline-none focus-visible:ring-2"
      style={{ backgroundColor: p.bg, borderColor: `${p.dot}33` }}
    >
      <div className="flex items-center gap-2">
        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: p.dot, flexShrink: 0 }} aria-hidden />
        <span className="flex-1 font-medium truncate" style={{ fontSize: 13, color: p.text }}>{card.title}</span>
        <span style={{ color: p.dot }}><ChevronRight expanded={expanded} /></span>
      </div>
      <div className="mt-2 space-y-1">
        {card.bullets.slice(0, 3).map((b, i) => (
          <p key={i} className="truncate" style={{ fontSize: 13, color: p.text, opacity: 0.72 }} title={b}>
            {`— ${b.length > 80 ? b.slice(0, 80) + '…' : b}`}
          </p>
        ))}
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="mt-3 space-y-1.5">
              {card.bullets.map((b, i) => (
                <p key={i} style={{ fontSize: 13, color: p.text, lineHeight: '1.55' }}>{`— ${b}`}</p>
              ))}
            </div>
            <a
              href={card.cta.action}
              onClick={(e) => e.stopPropagation()}
              className="mt-3 flex items-center justify-center font-semibold text-white no-underline"
              style={{ backgroundColor: p.btn, minHeight: 44, borderRadius: 10, fontSize: 13 }}
            >
              {card.cta.label}
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-cream-dark bg-white p-4 min-w-[240px] sm:min-w-0 flex-shrink-0 animate-pulse" aria-hidden>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-cream-dark" />
        <div className="h-3 w-32 rounded bg-cream-dark" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-cream-dark" />
        <div className="h-3 w-4/5 rounded bg-cream-dark" />
        <div className="h-3 w-3/5 rounded bg-cream-dark" />
      </div>
    </div>
  )
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('fetch failed')
    return r.json() as Promise<InsightsResponse>
  })

export default function CoachingCardsStrip() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [cards, setCards] = useState<CoachingInsight[] | null>(null)
  const [showRefreshed, setShowRefreshed] = useState(false)
  const [shouldFetch, setShouldFetch] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { generatedAt: string; insights: RankedInsight[] }
        const age = Date.now() - new Date(parsed.generatedAt).getTime()
        if (age < 24 * 60 * 60 * 1000) {
          setCards(padToFour(mapInsights({ insights: parsed.insights, generatedAt: parsed.generatedAt })))
          return
        }
      }
    } catch { /* ignore */ }
    setShouldFetch(true)
  }, [])

  const { data, mutate } = useSWR<InsightsResponse>(
    shouldFetch ? '/api/analytics/insights' : null,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 3_600_000 }
  )

  useEffect(() => {
    if (!data) return
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ generatedAt: data.generatedAt, insights: data.insights })) } catch { /* ignore */ }
    setCards(padToFour(mapInsights(data)))
    setShowRefreshed(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setShowRefreshed(false), 60_000)
  }, [data])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  useEffect(() => {
    const handle = () => {
      if (document.visibilityState === 'visible') { setShouldFetch(true); void mutate() }
    }
    document.addEventListener('visibilitychange', handle)
    return () => document.removeEventListener('visibilitychange', handle)
  }, [mutate])

  if (!cards) {
    return (
      <div aria-busy="true">
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:hidden">
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
        <div className="hidden sm:grid sm:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:hidden">
        {cards.map((card, i) => (
          <CoachingCard key={i} card={card} expanded={expandedIndex === i} onToggle={() => setExpandedIndex(expandedIndex === i ? null : i)} />
        ))}
      </div>
      <div className="hidden sm:grid sm:grid-cols-2 gap-3">
        {cards.map((card, i) => (
          <CoachingCard key={i} card={card} expanded={expandedIndex === i} onToggle={() => setExpandedIndex(expandedIndex === i ? null : i)} />
        ))}
      </div>
      <AnimatePresence>
        {showRefreshed && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mt-1.5 text-ink-muted" style={{ fontSize: 11 }}>
            Refreshed just now
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
