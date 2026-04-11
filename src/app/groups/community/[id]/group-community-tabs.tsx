"use client";

// src/app/groups/community/[id]/group-community-tabs.tsx
// Tab container: "Chat" | "Members" inside the community group page.
// Fires a session-visit ping on mount (once per day, deduplicated server-side).

import { useState, useEffect } from "react";
import { MessageSquare, Users } from "lucide-react";
import { GroupChatFeed } from "./group-chat-feed";
import { GroupMembersTab } from "./group-members-tab";
import type { ChatPostWithMeta } from "@/server/services/group-chat.service";

type Tab = "chat" | "members";

interface GroupCommunityTabsProps {
  groupId: string;
  initialPosts: ChatPostWithMeta[];
  isMember: boolean;
  memberCount: number;
}

export function GroupCommunityTabs({
  groupId,
  initialPosts,
  isMember,
  memberCount,
}: GroupCommunityTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  // Record session visit for engagement tracking (fire-and-forget)
  useEffect(() => {
    if (!isMember) return;
    fetch(`/api/groups/${groupId}/visit`, { method: "POST" }).catch(() => {});
  }, [groupId, isMember]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    {
      id: "chat",
      label: "Chat",
      icon: <MessageSquare className="h-4 w-4" />,
    },
    {
      id: "members",
      label: "Members",
      icon: <Users className="h-4 w-4" />,
      count: memberCount,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-cream-dark/50 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors
              ${activeTab === tab.id
                ? "bg-white shadow-sm text-ink"
                : "text-ink-muted hover:text-ink"
              }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs ${activeTab === tab.id ? "bg-cream-dark text-ink" : "bg-cream-dark/80 text-ink-muted"}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {activeTab === "chat" && (
        <GroupChatFeed
          groupId={groupId}
          initialPosts={initialPosts}
          isMember={isMember}
        />
      )}
      {activeTab === "members" && (
        <GroupMembersTab groupId={groupId} />
      )}
    </div>
  );
}
