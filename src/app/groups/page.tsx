// src/app/groups/page.tsx

import type { Metadata } from "next";
import { requireAuthUser } from "@/lib/auth/helpers";
import { groupGoalsService } from "@/server/services/group-goals.service";
import { groupsService } from "@/server/services/groups.service";
import { AppLayout } from "@/components/layout/app-layout";
import { GroupsPageClient } from "./groups-page-client";
import { GroupsPageTabs } from "./groups-page-tabs";

export const metadata: Metadata = {
  title: "Groups",
};

export default async function GroupsPage() {
  const user = await requireAuthUser();

  const [myGroups, myOldGroups, discoverGroups, invitableFriends] =
    await Promise.all([
      groupsService.getGroupsForUser(user.id),
      groupGoalsService.getAllForUser(user.id),
      groupsService.getDiscoverGroups(user.id),
      groupsService.getInvitableFriends(user.id),
    ]);

  return (
    <AppLayout>
      <div className="space-y-6">
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

        {/* ── Tabbed content ── */}
        <GroupsPageTabs
          myGroups={myGroups}
          myOldGroups={myOldGroups}
          initialAllGroups={discoverGroups}
          invitableFriends={invitableFriends}
          currentUserId={user.id}
        />
      </div>
    </AppLayout>
  );
}
