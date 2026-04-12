// src/app/groups/community/[id]/page.tsx
// Public Group Profile page for the new-model community groups.
// Accessible to authenticated users whether they're members or not.

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { requireAuthUser } from "@/lib/auth/helpers";
import { groupsService } from "@/server/services/groups.service";
import { AppLayout } from "@/components/layout/app-layout";
import { GroupProfileClient } from "./group-profile-client";
import { GroupGoalsClient } from "./group-goals-client";
import { GroupCommunityTabs } from "./group-community-tabs";
import { groupGoalItemsService } from "@/server/services/group-goal-items.service";
import { groupChatService } from "@/server/services/group-chat.service";
import { cn, initials } from "@/lib/utils/index";
import {
  Globe,
  Lock,
  Users,
  Crown,
  TrendingUp,
  Zap,
  ArrowLeft,
  Target,
  Star,
  Bell,
  ChevronRight,
} from "lucide-react";
import { db } from "@/lib/db";
import { groups as groupsTable, groupMembers } from "@/drizzle/schema";
import { and, avg, eq } from "drizzle-orm";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const [g] = await db
      .select({ name: groupsTable.name })
      .from(groupsTable)
      .where(eq(groupsTable.id, id))
      .limit(1);
    if (g) return { title: `${g.name} — NorthStar` };
  } catch {
    /* ignore */
  }
  return { title: "Group — NorthStar" };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

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
      ? "h-11 w-11 text-sm"
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

function TierBadge({ tier }: { tier: "Rising" | "Active" | "Elite" }) {
  const config = {
    Rising: {
      icon: <TrendingUp className="h-3 w-3" />,
      classes: "bg-sky-50 text-sky-600",
    },
    Active: {
      icon: <Zap className="h-3 w-3" />,
      classes: "bg-emerald-50 text-emerald-600",
    },
    Elite: {
      icon: <Crown className="h-3 w-3" />,
      classes: "bg-gold/10 text-gold",
    },
  };
  const { icon, classes } = config[tier];
  return (
    <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold", classes)}>
      {icon}
      {tier}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function CommunityGroupProfilePage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireAuthUser();

  const group = await groupsService.getGroupPublicProfile(id, user.id);
  if (!group) notFound();

  const isOwner = group.myRole === "owner";
  const isAdminOrOwner = isOwner || group.myRole === "admin";
  const isMember = group.myRole !== null;

  // For member rating: fetch their current rating from DB
  let myCurrentRating: number | null = null;
  if (isMember) {
    const [row] = await db
      .select({ recommendationRating: groupMembers.recommendationRating })
      .from(groupMembers)
      .where(
        and(eq(groupMembers.groupId, id), eq(groupMembers.userId, user.id))
      )
      .limit(1);
    myCurrentRating = row?.recommendationRating ?? null;
  }

  // Avg group rating from all members
  const [ratingRow] = await db
    .select({ avgRating: avg(groupMembers.recommendationRating) })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, id),
        eq(groupMembers.status, "active")
      )
    );
  const avgRating = ratingRow?.avgRating ? Math.round(Number(ratingRow.avgRating) * 10) / 10 : null;

  // Pending join requests count (owners only, for sidebar badge)
  let pendingCount = 0;
  if (isOwner) {
    const requests = await groupsService.getPendingJoinRequests(id, user.id);
    pendingCount = requests.length;
  }

  // Group goals (visible to all members + public group visitors)
  const groupGoals = isMember || group.type === "public"
    ? await groupGoalItemsService.getGroupGoals(id, user.id)
    : [];

  // Chat posts
  const initialPosts = isMember || group.type === "public"
    ? await groupChatService.getPosts(id, user.id)
    : [];

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6 pb-12">
        {/* ── Back link ── */}
        <Link
          href="/groups"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Groups
        </Link>

        {/* ── Hero ── */}
        <div className="overflow-hidden rounded-3xl border border-cream-dark bg-cream-paper shadow-sm">
          {/* Banner */}
          <div className="relative h-36 w-full bg-gradient-to-br from-gold/10 via-gold/20 to-gold/8">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-gold/80 to-gold/30" />

            {/* Badges top-right */}
            <div className="absolute right-4 top-4 flex items-center gap-2">
              {group.popularityRank && group.popularityRank <= 10 && (
                <span className="flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-xs font-bold text-cream-paper">
                  <Star className="h-3.5 w-3.5 fill-cream-paper" />
                  Rank #{group.popularityRank}
                </span>
              )}
              {group.type === "public" ? (
                <span className="flex items-center gap-1 rounded-full bg-cream-paper/80 px-2.5 py-1 text-[11px] font-medium text-emerald-700 backdrop-blur-sm">
                  <Globe className="h-3 w-3" />
                  Public
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-cream-paper/80 px-2.5 py-1 text-[11px] font-medium text-ink-muted backdrop-blur-sm">
                  <Lock className="h-3 w-3" />
                  Private
                </span>
              )}
            </div>

            {/* Group icon */}
            <div className="absolute bottom-0 left-6 translate-y-1/2">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-gold/30 bg-gradient-to-br from-gold/20 to-gold/40 text-3xl shadow-md backdrop-blur-sm">
                🌟
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pb-6 pt-14">
            <h1 className="font-serif text-2xl font-bold leading-tight text-ink sm:text-3xl">
              {group.name}
            </h1>

            {group.description && (
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-muted">
                {group.description}
              </p>
            )}

            {/* Stats row */}
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {/* Members */}
              <div className="flex items-center gap-1.5 text-sm text-ink-muted">
                <Users className="h-4 w-4" />
                <strong className="text-ink">{group.memberCount.toLocaleString()}</strong>{" "}
                {group.memberCount === 1 ? "member" : "members"}
              </div>

              {/* Active goals */}
              {groupGoals.length > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-ink-muted">
                  <Target className="h-4 w-4" />
                  <strong className="text-ink">{groupGoals.length}</strong> active{" "}
                  {groupGoals.length === 1 ? "goal" : "goals"}
                </div>
              )}

              {/* Popularity score + tier */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-muted">
                  <strong className="text-ink">{group.popularityScore}</strong>
                  <span className="ml-1 text-xs">/100</span>
                </span>
                <TierBadge tier={group.popularityTier} />
              </div>

              {/* Avg rating */}
              {avgRating && avgRating > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-gold text-gold" />
                  <span className="text-sm font-semibold text-ink">{avgRating}</span>
                  <span className="text-xs text-ink-muted">/5</span>
                </div>
              )}

              {/* Role badge */}
              {isMember && (
                <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">
                  {isOwner
                    ? "You own this group"
                    : group.myRole === "admin"
                      ? "You're an admin"
                      : "You're a member"}
                </span>
              )}
            </div>

            {/* Actions (join / rate / archive) */}
            <div className="mt-5">
              <GroupProfileClient
                groupId={group.id}
                myRole={group.myRole}
                myJoinRequestStatus={group.myJoinRequestStatus}
                groupType={group.type}
                myRecommendationRating={myCurrentRating}
              />
            </div>
          </div>
        </div>

        {/* ── Main layout ── */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* ── Main content (goals + feed) ── */}
          <div className="space-y-6 lg:col-span-2">
            {/* Private gate for non-members */}
            {group.type === "private" && !isMember && (
              <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-cream-dark bg-cream-paper/60 px-8 py-16 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-cream-dark text-3xl">
                  🔒
                </div>
                <p className="font-serif text-xl font-semibold text-ink">
                  Private Group — Invite Only
                </p>
                <p className="mt-2 max-w-xs text-sm text-ink-muted">
                  This group is invite-only. Ask a member to invite you, or explore other public
                  groups.
                </p>
                <Link
                  href="/groups/discover"
                  className="btn-gold mt-6 inline-flex items-center gap-2"
                >
                  <Globe className="h-4 w-4" />
                  Browse Public Groups
                </Link>
              </div>
            )}

            {/* Public non-member: teaser stats */}
            {group.type === "public" && !isMember && (
              <div className="rounded-3xl border border-cream-dark bg-cream-paper p-5 shadow-sm">
                <div className="grid grid-cols-3 gap-4 rounded-2xl border border-cream-dark bg-cream p-4">
                  <div className="text-center">
                    <p className="font-serif text-xl font-bold text-ink">
                      {group.memberCount.toLocaleString()}
                    </p>
                    <p className="text-xs text-ink-muted">Members</p>
                  </div>
                  <div className="text-center">
                    <p className="font-serif text-xl font-bold text-ink">
                      {groupGoals.length}
                    </p>
                    <p className="text-xs text-ink-muted">Active goals</p>
                  </div>
                  <div className="text-center">
                    <p
                      className={cn(
                        "font-serif text-xl font-bold",
                        group.popularityTier === "Elite"
                          ? "text-gold"
                          : group.popularityTier === "Active"
                            ? "text-emerald-600"
                            : "text-sky-600"
                      )}
                    >
                      {group.popularityTier}
                    </p>
                    <p className="text-xs text-ink-muted">Tier</p>
                  </div>
                </div>
              </div>
            )}

            {/* Goals section */}
            {(isMember || group.type === "public") && (
              <section className="space-y-4">
                <GroupGoalsClient
                  groupId={group.id}
                  goals={groupGoals}
                  isMember={isMember}
                  isAdminOrOwner={isAdminOrOwner}
                  isOwner={isOwner}
                />
              </section>
            )}

            {/* Group Feed (chat + activity) */}
            {(isMember || group.type === "public") && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink">
                    <span className="text-[14px] leading-none text-cream-paper">💬</span>
                  </div>
                  <h2 className="font-serif text-xl font-semibold text-ink">Group Feed</h2>
                </div>
                <GroupCommunityTabs
                  groupId={group.id}
                  initialPosts={initialPosts}
                  isMember={isMember}
                  memberCount={group.memberCount}
                />
              </section>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-4 lg:col-span-1">
            {/* Join requests (owner only) */}
            {isOwner && pendingCount > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-semibold text-amber-800">
                      {pendingCount} join{" "}
                      {pendingCount === 1 ? "request" : "requests"}
                    </p>
                  </div>
                  <Link
                    href={`/groups/community/${id}/requests`}
                    className="flex items-center gap-0.5 text-xs font-semibold text-amber-700 hover:text-amber-900"
                  >
                    Review
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {/* Members list */}
            <div className="overflow-hidden rounded-3xl border border-cream-dark bg-cream-paper shadow-sm">
              <div className="border-b border-cream-dark px-5 py-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-ink-muted" />
                  <h2 className="font-serif text-base font-semibold text-ink">Members</h2>
                  <span className="ml-auto rounded-full bg-cream-dark px-2 py-0.5 text-xs font-semibold text-ink-muted">
                    {group.memberCount}
                  </span>
                </div>
              </div>
              <div className="p-4">
                {group.type === "private" && !isMember ? (
                  <p className="text-center text-sm text-ink-muted">
                    🔒 Members are hidden for private groups.
                  </p>
                ) : group.members.length === 0 ? (
                  <p className="text-center text-sm text-ink-muted">No members yet.</p>
                ) : (
                  <div className="space-y-3">
                    {group.members.map((m) => (
                      <div key={m.id} className="flex items-center gap-3">
                        <Avatar name={m.name} image={m.image} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">
                            {m.name ?? m.username ?? "Member"}
                          </p>
                          {m.username && (
                            <p className="truncate text-xs text-ink-muted">@{m.username}</p>
                          )}
                        </div>
                        {m.role === "owner" && (
                          <Crown className="h-3.5 w-3.5 shrink-0 text-gold" />
                        )}
                        {m.role === "admin" && (
                          <span className="shrink-0 rounded-full bg-cream-dark px-2 py-0.5 text-[0.6rem] font-semibold text-ink-muted">
                            Admin
                          </span>
                        )}
                      </div>
                    ))}
                    {group.memberCount > group.members.length && (
                      <p className="pt-1 text-center text-xs text-ink-muted">
                        +{group.memberCount - group.members.length} more members
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
