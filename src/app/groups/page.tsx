// src/app/groups/page.tsx

import type { Metadata } from "next";
import { requireAuthUser } from "@/lib/auth/helpers";
import { groupGoalsService } from "@/server/services/group-goals.service";
import { groupsService } from "@/server/services/groups.service";
import { GroupGoalCard } from "@/components/group-goals/group-goal-card";
import { GroupCard } from "@/components/group-goals/group-card";
import { AppLayout } from "@/components/layout/app-layout";
import { GroupsPageClient } from "./groups-page-client";
import { Compass, Users, Star } from "lucide-react";

export const metadata: Metadata = {
  title: "Groups",
};

export default async function GroupsPage() {
  const user = await requireAuthUser();

  const [myGroups, myOldGroups, discoverGroups, discoverOldGroups, invitableFriends] =
    await Promise.all([
      groupsService.getGroupsForUser(user.id),
      groupGoalsService.getAllForUser(user.id),
      groupsService.getDiscoverGroups(user.id),
      groupGoalsService.getDiscoverForUser(user.id),
      groupsService.getInvitableFriends(user.id),
    ]);

  const hasAnyGroup = myGroups.length > 0 || myOldGroups.length > 0;
  const hasDiscover = discoverGroups.length > 0 || discoverOldGroups.length > 0;
  const totalMyCount = myGroups.length + myOldGroups.length;

  return (
    <AppLayout>
      <div className="space-y-10">
        {/* ── Page Header ── */}
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="section-label mb-2">Community</p>
            <h1 className="font-serif text-3xl font-semibold text-ink lg:text-4xl">
              Groups
            </h1>
            <p className="mt-2 max-w-md font-serif text-sm italic leading-relaxed text-ink-muted">
              Chase goals together. Shared accountability, compounded results.
            </p>
          </div>
          <div className="shrink-0">
            <GroupsPageClient invitableFriends={invitableFriends} />
          </div>
        </div>

        {/* ── My Groups ── */}
        <section>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink">
              <Users className="h-3.5 w-3.5 text-cream-paper" />
            </div>
            <h2 className="font-serif text-xl font-semibold text-ink">My Groups</h2>
            {totalMyCount > 0 && (
              <span className="rounded-full bg-cream-dark px-2.5 py-0.5 text-xs font-semibold text-ink-muted">
                {totalMyCount}
              </span>
            )}
          </div>

          {!hasAnyGroup ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-cream-dark bg-cream-paper/60 px-8 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-cream-dark text-3xl">
                🏆
              </div>
              <p className="font-serif text-xl font-semibold text-ink">No groups yet</p>
              <p className="mt-2 max-w-xs text-sm text-ink-muted">
                Create your first group or discover public groups below and request to join.
              </p>
              <div className="mt-6">
                <GroupsPageClient invitableFriends={invitableFriends} variant="inline" />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* New-model groups */}
              {myGroups.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {myGroups.map((group) => (
                    <GroupCard
                      key={group.id}
                      group={group}
                      currentUserId={user.id}
                    />
                  ))}
                </div>
              )}

              {/* Legacy collaborative group-goals */}
              {myOldGroups.length > 0 && (
                <>
                  {myGroups.length > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cream-dark">
                        <Star className="h-3 w-3 text-ink-muted" />
                      </div>
                      <p className="section-label text-ink-muted">Collaborative Goals</p>
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {myOldGroups.map((group) => (
                      <GroupGoalCard
                        key={group.id}
                        group={group}
                        currentUserId={user.id}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        {/* ── Discover Groups ── */}
        {hasDiscover && (
          <section>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cream-dark">
                <Compass className="h-3.5 w-3.5 text-ink" />
              </div>
              <h2 className="font-serif text-xl font-semibold text-ink">Discover Groups</h2>
              <span className="rounded-full bg-cream-dark px-2.5 py-0.5 text-xs font-semibold text-ink-muted">
                {discoverGroups.length + discoverOldGroups.length}
              </span>
            </div>

            <div className="space-y-6">
              {discoverGroups.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {discoverGroups.map((group) => (
                    <GroupCard
                      key={group.id}
                      group={group}
                      currentUserId={user.id}
                    />
                  ))}
                </div>
              )}

              {discoverOldGroups.length > 0 && (
                <>
                  {discoverGroups.length > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cream-dark">
                        <Star className="h-3 w-3 text-ink-muted" />
                      </div>
                      <p className="section-label text-ink-muted">Collaborative Goals</p>
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {discoverOldGroups.map((group, index) => (
                      <GroupGoalCard
                        key={group.id}
                        group={{ ...group, rank: index + 1 }}
                        currentUserId={user.id}
                        hideMemberDetails
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
