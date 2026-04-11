"use client";

// src/app/groups/[id]/group-detail-tabs.tsx
// Tabbed layout: Intentions | Tasks | Members | Chat

import { useState } from "react";
import Link from "next/link";
import { Lightbulb, CheckSquare, Users, MessageCircle } from "lucide-react";
import { GroupChat } from "@/components/group-goals/group-chat";
import { GroupTaskBoard } from "@/components/group-goals/group-task-board";
import { GroupIntentionsBoard } from "@/components/group-goals/group-intentions-board";
import { cn, formatUnit, initials } from "@/lib/utils/index";
import type {
  GroupTask,
  GroupIntention,
  GroupIdeaSubmission,
  MemberWithUser,
} from "@/server/services/group-goals.service";
import type { GroupGoalMessage } from "@/drizzle/schema";

type TabId = "intentions" | "tasks" | "members" | "chat";

interface GroupDetailTabsProps {
  group: {
    id: string;
    unit?: string;
    targetValue?: number;
    accentColor: string;
    canInteract: boolean;
    isCreator: boolean;
  };
  currentUserId: string;
  sortedMembers: MemberWithUser[];
  tasks: GroupTask[];
  intentions: GroupIntention[];
  ideaSubmissions: GroupIdeaSubmission[];
  messages: (GroupGoalMessage & {
    user: { id: string; name: string | null; image: string | null };
  })[];
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "intentions", label: "Intentions", icon: <Lightbulb className="h-4 w-4" /> },
  { id: "tasks", label: "Tasks", icon: <CheckSquare className="h-4 w-4" /> },
  { id: "members", label: "Members", icon: <Users className="h-4 w-4" /> },
  { id: "chat", label: "Chat", icon: <MessageCircle className="h-4 w-4" /> },
];

function Avatar({ name, image }: { name: string | null; image: string | null }) {
  return (
    <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold text-xs font-bold text-ink">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={name ?? ""} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </div>
  );
}

export function GroupDetailTabs({
  group,
  currentUserId,
  sortedMembers,
  tasks,
  intentions,
  ideaSubmissions,
  messages,
}: GroupDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("intentions");

  return (
    <div className="overflow-hidden rounded-3xl border border-cream-dark bg-cream-paper shadow-sm">
      {/* Tab bar */}
      <div className="flex border-b border-cream-dark">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 px-2 py-3.5 text-xs font-semibold transition-all",
              activeTab === tab.id
                ? "border-b-2 border-ink text-ink"
                : "text-ink-muted hover:text-ink"
            )}
            style={
              activeTab === tab.id
                ? { borderBottomColor: group.accentColor, color: group.accentColor }
                : {}
            }
          >
            {tab.icon}
            <span className="hidden sm:block">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="p-5">
        {activeTab === "intentions" && (
          <GroupIntentionsBoard
            groupGoalId={group.id}
            isCreator={group.isCreator}
            canInteract={group.canInteract}
            currentUserId={currentUserId}
            initialIntentions={intentions}
            initialIdeas={ideaSubmissions}
            accentColor={group.accentColor}
          />
        )}

        {activeTab === "tasks" && (
          <GroupTaskBoard
            groupGoalId={group.id}
            canInteract={group.canInteract}
            initialTasks={tasks}
          />
        )}

        {activeTab === "members" && (
          <MembersLeaderboard
            members={sortedMembers}
            currentUserId={currentUserId}
            targetValue={group.targetValue}
            unit={group.unit}
            accentColor={group.accentColor}
          />
        )}

        {activeTab === "chat" && (
          <GroupChat
            groupGoalId={group.id}
            currentUserId={currentUserId}
            initialMessages={messages}
          />
        )}
      </div>
    </div>
  );
}

function MembersLeaderboard({
  members,
  currentUserId,
  targetValue,
  unit,
  accentColor,
}: {
  members: MemberWithUser[];
  currentUserId: string;
  targetValue?: number;
  unit?: string;
  accentColor: string;
}) {
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-2">
      <p className="section-label mb-4">Leaderboard</p>
      {members.map((member, index) => {
        const pct =
          targetValue && targetValue > 0
            ? Math.min(100, (member.contribution / targetValue) * 100)
            : 0;
        const isYou = member.userId === currentUserId;

        return (
          <div
            key={member.id}
            className={cn(
              "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all",
              isYou
                ? "border-gold/30 bg-gold/5"
                : index < 3
                  ? "border-cream-dark bg-cream"
                  : "border-cream-dark bg-cream-paper"
            )}
          >
            {/* Rank */}
            <span className="w-6 text-center text-sm">
              {medals[index] ?? (
                <span className="font-mono text-xs font-semibold text-ink-muted">
                  {index + 1}
                </span>
              )}
            </span>

            {/* Avatar */}
            <Avatar name={member.user.name} image={member.user.image} />

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    "truncate text-sm font-semibold",
                    isYou ? "text-gold" : "text-ink"
                  )}
                >
                  {isYou ? (
                    "You"
                  ) : member.user.username ? (
                    <Link
                      href={`/profile/${member.user.username}`}
                      className="hover:text-gold hover:underline"
                    >
                      {member.user.name ?? `@${member.user.username}`}
                    </Link>
                  ) : (
                    member.user.name ?? "Member"
                  )}
                  {member.role === "creator" && (
                    <span className="ml-1.5 text-[10px] font-normal text-gold">
                      ✦ creator
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-ink-muted">
                  {formatUnit(member.contribution, unit)}
                </span>
              </div>
              {targetValue ? (
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-cream-dark">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: accentColor }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
