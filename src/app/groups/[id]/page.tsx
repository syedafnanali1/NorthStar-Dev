// src/app/groups/[id]/page.tsx
// Premium group detail page with tabbed layout.

import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuthUser } from "@/lib/auth/helpers";
import { groupGoalsService } from "@/server/services/group-goals.service";
import { GroupChat } from "@/components/group-goals/group-chat";
import { GroupTaskBoard } from "@/components/group-goals/group-task-board";
import { GroupIntentionsBoard } from "@/components/group-goals/group-intentions-board";
import { ProgressRing } from "@/components/ui/progress-ring";
import { cn, formatUnit, categoryColor, initials } from "@/lib/utils/index";
import {
  Clock,
  Crown,
  Lock,
  Medal,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { GroupDetailClient } from "./group-detail-client";
import { JoinRequestsPanel } from "./join-requests-panel";
import { InviteMembersPanel } from "./invite-members-panel";
import { GroupDetailTabs } from "./group-detail-tabs";

interface PageProps {
  params: Promise<{ id: string }>;
}

function Avatar({
  name,
  image,
  size = "md",
}: {
  name: string | null;
  image: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const dim =
    size === "lg"
      ? "h-12 w-12 text-sm"
      : size === "md"
        ? "h-9 w-9 text-xs"
        : "h-7 w-7 text-[10px]";
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold font-bold text-ink",
        dim
      )}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={name ?? ""} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </div>
  );
}

function RankChip({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-xs font-bold text-cream-paper">
        <Medal className="h-3.5 w-3.5" /> Rank #1
      </span>
    );
  if (rank <= 3)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-xs font-bold text-cream-paper">
        <Medal className="h-3.5 w-3.5" /> Rank #{rank}
      </span>
    );
  if (rank <= 10)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-dark px-3 py-1 text-xs font-semibold text-ink-muted">
        <TrendingUp className="h-3.5 w-3.5" /> Rank #{rank}
      </span>
    );
  return null;
}

export default async function GroupDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireAuthUser();

  const group = await groupGoalsService.getGroupDetail(id, user.id);
  if (!group) notFound();

  const accentColor = group.color ?? categoryColor(group.category);
  const isMember = group.canInteract;
  const isCreator = group.viewerAccess === "creator";
  const sortedMembers = [...group.members].sort((a, b) => b.contribution - a.contribution);
  const creator = group.creatorUser ?? group.members.find((m) => m.role === "creator")?.user ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">

      {/* ── Hero Card ── */}
      <div className="overflow-hidden rounded-3xl border border-cream-dark bg-cream-paper shadow-sm">
        {/* Gradient banner */}
        <div
          className="relative h-36 w-full"
          style={{
            background: `linear-gradient(135deg, ${accentColor}18 0%, ${accentColor}40 50%, ${accentColor}22 100%)`,
          }}
        >
          <div className="absolute inset-x-0 top-0 h-1" style={{ background: accentColor }} />

          {/* Rank + public badge */}
          <div className="absolute right-4 top-4 flex items-center gap-2">
            {group.isPublic && group.rank && <RankChip rank={group.rank} />}
            {group.isPublic ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-cream-paper/80 px-2.5 py-1 text-[11px] font-medium text-ink-muted backdrop-blur-sm">
                <ShieldCheck className="h-3 w-3" /> Public
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-cream-paper/80 px-2.5 py-1 text-[11px] font-medium text-ink-muted backdrop-blur-sm">
                <Lock className="h-3 w-3" /> Private
              </span>
            )}
          </div>

          {/* Emoji */}
          <div className="absolute bottom-0 left-6 translate-y-1/2">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-2xl text-4xl shadow-md"
              style={{
                background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}44)`,
                border: `2px solid ${accentColor}55`,
                backdropFilter: "blur(4px)",
              }}
            >
              {group.emoji ?? "⭐"}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 pt-14">
          {/* Category */}
          <p className="section-label mb-1">{group.category}</p>

          {/* Title */}
          <h1 className="font-serif text-2xl font-semibold leading-tight text-ink sm:text-3xl">
            {group.title}
          </h1>

          {/* Description */}
          {group.description && (
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{group.description}</p>
          )}

          {/* Creator + stats row */}
          <div className="mt-4 flex flex-wrap items-center gap-4">
            {creator && (
              <div className="flex items-center gap-2">
                <Avatar name={creator.name} image={creator.image} size="sm" />
                <span className="text-xs text-ink-muted">
                  <Crown className="mr-0.5 inline h-3 w-3 text-gold" />
                  {creator.username ? (
                    <Link
                      href={`/profile/${creator.username}`}
                      className="font-medium text-ink hover:text-gold hover:underline"
                    >
                      {creator.name ?? `@${creator.username}`}
                    </Link>
                  ) : (
                    <span className="font-medium text-ink">{creator.name ?? "Creator"}</span>
                  )}
                </span>
              </div>
            )}

            <span className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Users className="h-3.5 w-3.5" />
              <strong className="text-ink">{group.memberCount}</strong>{" "}
              {group.memberCount === 1 ? "member" : "members"}
            </span>

            {group.daysLeft !== null && (
              <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                <Clock className="h-3.5 w-3.5" />
                {group.daysLeft > 0 ? (
                  <>
                    <strong className="text-ink">{group.daysLeft}</strong> days left
                  </>
                ) : (
                  "Ended"
                )}
              </span>
            )}

            {isMember && (
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{ background: `${accentColor}18`, color: accentColor }}
              >
                {group.percentComplete}% complete
              </span>
            )}
          </div>

          {/* Progress bar (members only) */}
          {isMember && group.targetValue ? (
            <div className="mt-5 space-y-2">
              <div className="flex justify-between text-xs text-ink-muted">
                <span>{formatUnit(group.currentValue, group.unit)}</span>
                <span>Goal: {formatUnit(group.targetValue, group.unit)}</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-cream-dark">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${group.percentComplete}%`, background: accentColor }}
                />
              </div>
            </div>
          ) : null}

          {/* Non-member preview notice */}
          {!isMember && (
            <div
              className="mt-5 rounded-2xl border px-4 py-3"
              style={{ borderColor: `${accentColor}33`, background: `${accentColor}0A` }}
            >
              <p className="flex items-center gap-2 text-sm font-medium text-ink">
                <Lock className="h-4 w-4" style={{ color: accentColor }} />
                Members-only content
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Request to join to see progress details, intentions, member breakdown, and group chat.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-5 flex flex-wrap gap-2">
            <GroupDetailClient
              groupGoalId={group.id}
              unit={group.unit ?? undefined}
              isCreator={isCreator}
              canInteract={isMember}
              viewerJoinRequestStatus={group.viewerJoinRequestStatus}
              accentColor={accentColor}
            />
          </div>
        </div>
      </div>

      {/* ── Creator tools: invite + join requests ── */}
      {isCreator && (
        <div className="space-y-4">
          <InviteMembersPanel groupGoalId={group.id} />
          <JoinRequestsPanel groupGoalId={group.id} requests={group.pendingRequests} />
        </div>
      )}

      {/* ── Tabbed content (members only) ── */}
      {isMember ? (
        <GroupDetailTabs
          group={{
            id: group.id,
            unit: group.unit ?? undefined,
            targetValue: group.targetValue ?? undefined,
            accentColor,
            canInteract: group.canInteract,
            isCreator,
          }}
          currentUserId={user.id}
          sortedMembers={sortedMembers}
          tasks={group.tasks}
          intentions={group.intentions}
          ideaSubmissions={group.ideaSubmissions}
          messages={group.messages}
        />
      ) : null}
    </div>
  );
}
