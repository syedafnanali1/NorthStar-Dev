"use client";

// src/app/groups/community/[id]/group-goal-card.tsx
// Card displaying a single group goal with: frequency badge, progress ring/bar,
// milestone chips, aggregate tracker count, leaderboard, and check-in panel.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Flame,
  Trophy,
  Zap,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils/index";
import { toast } from "@/components/ui/toaster";
import type { GroupGoalWithMeta } from "@/server/services/group-goal-items.service";

// ── Frequency label ────────────────────────────────────────────────────────────

function FrequencyBadge({
  frequency,
  customLabel,
}: {
  frequency: string;
  customLabel: string | null;
}) {
  const labels: Record<string, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
    custom: customLabel ?? "Custom",
  };
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-cream-dark bg-cream px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest text-ink-muted">
      <Zap className="h-2.5 w-2.5 text-gold" />
      {labels[frequency] ?? frequency}
    </span>
  );
}

// ── Progress ring ──────────────────────────────────────────────────────────────

function ProgressRing({
  pct,
  size = 56,
  color = "#C4963A",
}: {
  pct: number;
  size?: number;
  color?: string;
}) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 100) / 100);
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--cream-dark, #EDE7DE)" strokeWidth={5} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
    </svg>
  );
}

// ── Milestone chip ─────────────────────────────────────────────────────────────

function MilestoneChip({ text, done }: { text: string; done?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors",
        done
          ? "bg-emerald-50 text-emerald-700 line-through opacity-70"
          : "bg-cream-dark text-ink-muted"
      )}
    >
      {done && <Check className="h-3 w-3 shrink-0" />}
      {text}
    </span>
  );
}

// ── Leaderboard row ────────────────────────────────────────────────────────────

function LeaderboardRow({
  rank,
  name,
  image,
  checkIns,
  isCompleted,
}: {
  rank: number;
  name: string | null;
  image: string | null;
  checkIns: number;
  isCompleted: boolean;
}) {
  const inits = name
    ? name.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")
    : "?";

  const rankIcon =
    rank === 1 ? <Crown className="h-3 w-3 text-gold" /> :
    rank === 2 ? <Trophy className="h-3 w-3 text-ink-muted" /> :
    rank === 3 ? <Flame className="h-3 w-3 text-rose-400" /> :
    <span className="w-3 text-center text-[10px] font-bold text-ink-muted">{rank}</span>;

  return (
    <div className="flex items-center gap-2">
      <div className="flex w-5 items-center justify-center">{rankIcon}</div>
      <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold text-[10px] font-bold text-ink">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={name ?? ""} className="h-full w-full object-cover" />
        ) : (
          inits
        )}
      </div>
      <span className="min-w-0 flex-1 truncate text-xs text-ink">{name ?? "Member"}</span>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-muted">
        {checkIns} {checkIns === 1 ? "check-in" : "check-ins"}
      </span>
      {isCompleted && (
        <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[0.6rem] font-bold text-emerald-600">
          ✓ Done
        </span>
      )}
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

interface GroupGoalCardProps {
  goal: GroupGoalWithMeta;
  groupId: string;
  isMember: boolean;
  isAdminOrOwner: boolean;
}

export function GroupGoalCard({
  goal,
  groupId,
  isMember,
  isAdminOrOwner,
}: GroupGoalCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [trackBusy, setTrackBusy] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInValue, setCheckInValue] = useState("1");
  const [checkInNote, setCheckInNote] = useState("");
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [localTracked, setLocalTracked] = useState(goal.myTracker !== null);
  const [localCheckIns, setLocalCheckIns] = useState(goal.myTracker?.checkInsCompleted ?? 0);

  const milestones = (goal.milestones ?? []) as string[];
  const trackerPct =
    goal.trackerCount > 0
      ? Math.round((goal.completedCount / goal.trackerCount) * 100)
      : 0;

  const categoryColors: Record<string, string> = {
    health: "#5B7EA6",
    finance: "#C4963A",
    writing: "#7B6FA0",
    body: "#B5705B",
    mindset: "#6B8C7A",
    custom: "#C4963A",
  };
  const accentColor = categoryColors[goal.category] ?? "#C4963A";

  async function handleTrack() {
    setTrackBusy(true);
    try {
      const res = await fetch(
        `/api/groups/${groupId}/goals/${goal.id}/track`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed");
      }
      const data = (await res.json()) as { added: boolean };
      setLocalTracked(data.added);
      toast(
        data.added
          ? "Goal added to your calendar!"
          : "Removed from your calendar.",
        "success"
      );
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update calendar", "error");
    } finally {
      setTrackBusy(false);
    }
  }

  async function handleCheckIn() {
    const val = Number.parseFloat(checkInValue);
    if (!Number.isFinite(val) || val <= 0) {
      toast("Enter a valid value greater than 0.", "error");
      return;
    }
    setCheckInBusy(true);
    try {
      const res = await fetch(
        `/api/groups/${groupId}/goals/${goal.id}/checkin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: val, note: checkInNote.trim() || undefined }),
        }
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to log check-in");
      }
      setLocalCheckIns((c) => c + 1);
      setCheckInOpen(false);
      setCheckInValue("1");
      setCheckInNote("");
      toast("Check-in logged!", "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to log check-in", "error");
    } finally {
      setCheckInBusy(false);
    }
  }

  async function handleArchive() {
    if (!confirm("Archive this goal? It won't be visible to members anymore.")) return;
    try {
      const res = await fetch(`/api/groups/${groupId}/goals`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId: goal.id }),
      });
      if (!res.ok) throw new Error("Failed to archive");
      toast("Goal archived.", "success");
      router.refresh();
    } catch {
      toast("Failed to archive goal.", "error");
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-cream-dark bg-cream-paper shadow-sm transition-all">
      {/* Top accent stripe */}
      <div className="h-1 w-full" style={{ background: accentColor }} />

      {/* Card body */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Emoji + progress ring */}
          <div className="relative shrink-0">
            <ProgressRing pct={trackerPct} size={52} color={accentColor} />
            <div className="absolute inset-0 flex items-center justify-center text-xl">
              {goal.emoji ?? "⭐"}
            </div>
          </div>

          {/* Main content */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-serif text-base font-semibold text-ink leading-snug">
                {goal.title}
              </h3>
              <FrequencyBadge
                frequency={goal.trackingFrequency}
                customLabel={goal.customFrequencyLabel}
              />
              {goal.createdVia === "ai" && (
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[0.6rem] font-bold text-violet-600">
                  ✦ AI
                </span>
              )}
            </div>

            {goal.description && (
              <p className="mt-1 text-xs leading-relaxed text-ink-muted line-clamp-2">
                {goal.description}
              </p>
            )}

            {/* Stats row */}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
              <span>
                <strong className="text-ink">{goal.trackerCount}</strong>{" "}
                {goal.trackerCount === 1 ? "member" : "members"} tracking
              </span>
              <span>
                <strong className="text-ink">{goal.aggregateCheckIns}</strong> total check-ins
              </span>
              {goal.completedCount > 0 && (
                <span className="text-emerald-600 font-semibold">
                  {goal.completedCount} completed
                </span>
              )}
              {localTracked && (
                <span className="text-ink font-semibold">
                  You: {localCheckIns} check-in{localCheckIns !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          {/* Expand toggle */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-1 shrink-0 rounded-lg p-1.5 text-ink-muted transition hover:bg-cream-dark hover:text-ink"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Aggregate progress bar */}
        {goal.trackerCount > 0 && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-[0.65rem] text-ink-muted">
              <span>Group completion</span>
              <span className="font-semibold">{trackerPct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-cream-dark">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${trackerPct}%`, background: accentColor }}
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
        {isMember && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleTrack()}
              disabled={trackBusy}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50",
                localTracked
                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "bg-ink text-cream-paper hover:opacity-90"
              )}
            >
              {localTracked ? (
                <><CalendarCheck className="h-3.5 w-3.5" /> On my calendar</>
              ) : (
                <><CalendarPlus className="h-3.5 w-3.5" /> Add to my calendar</>
              )}
            </button>

            {localTracked && (
              <button
                type="button"
                onClick={() => setCheckInOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-full border border-cream-dark px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-ink hover:text-ink"
              >
                <Check className="h-3.5 w-3.5" />
                Log check-in
              </button>
            )}
          </div>
        )}

        {/* Check-in form */}
        {checkInOpen && localTracked && (
          <div className="mt-3 rounded-xl border border-cream-dark bg-cream p-3">
            <p className="mb-2 text-xs font-semibold text-ink">Log your check-in</p>
            <div className="flex gap-2">
              <input
                type="number"
                min="0.01"
                step="any"
                value={checkInValue}
                onChange={(e) => setCheckInValue(e.target.value)}
                placeholder={goal.unit ? `Amount in ${goal.unit}` : "Value (default: 1)"}
                className="form-input flex-1 py-1.5 text-sm"
              />
              <input
                value={checkInNote}
                onChange={(e) => setCheckInNote(e.target.value)}
                placeholder="Note (optional)"
                className="form-input flex-1 py-1.5 text-sm"
                maxLength={200}
              />
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void handleCheckIn()}
                disabled={checkInBusy}
                className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-cream-paper transition hover:opacity-90 disabled:opacity-40"
              >
                {checkInBusy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setCheckInOpen(false)}
                className="rounded-full px-3 py-1.5 text-xs text-ink-muted hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Expanded: milestones + leaderboard */}
      {expanded && (
        <div className="border-t border-cream-dark bg-cream px-4 py-4 space-y-4">
          {/* Milestones */}
          {milestones.length > 0 && (
            <div>
              <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-widest text-ink-muted">
                Milestones
              </p>
              <div className="flex flex-wrap gap-1.5">
                {milestones.map((m, i) => (
                  <MilestoneChip key={i} text={m} done={false} />
                ))}
              </div>
            </div>
          )}

          {/* Leaderboard */}
          {goal.leaderboard.length > 0 && (
            <div>
              <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-widest text-ink-muted">
                Top contributors
              </p>
              <div className="space-y-2">
                {goal.leaderboard.map((row, i) => (
                  <LeaderboardRow
                    key={row.userId}
                    rank={i + 1}
                    name={row.name}
                    image={row.image}
                    checkIns={row.checkIns}
                    isCompleted={row.isCompleted}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Admin: archive */}
          {isAdminOrOwner && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => void handleArchive()}
                className="text-xs text-ink-muted underline-offset-2 hover:text-rose-600 hover:underline"
              >
                Archive this goal
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
