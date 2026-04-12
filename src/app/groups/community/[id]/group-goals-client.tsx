"use client";

// src/app/groups/community/[id]/group-goals-client.tsx
// Client shell for the Goals section:
// - Opens the Create Goal modal (admins/owners)
// - Renders goal cards with all interactive features

import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { CreateGroupGoalModal } from "./create-group-goal-modal";
import { GroupGoalCard } from "./group-goal-card";
import type { GroupGoalWithMeta } from "@/server/services/group-goal-items.service";

interface GroupGoalsClientProps {
  groupId: string;
  goals: GroupGoalWithMeta[];
  isMember: boolean;
  isAdminOrOwner: boolean;
  isOwner: boolean;
}

export function GroupGoalsClient({
  groupId,
  goals,
  isMember,
  isAdminOrOwner,
  isOwner,
}: GroupGoalsClientProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      {/* Section header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink">
            <Target className="h-3.5 w-3.5 text-cream-paper" />
          </div>
          <h2 className="font-serif text-xl font-semibold text-ink">Group Goals</h2>
          {goals.length > 0 && (
            <span className="rounded-full bg-cream-dark px-2.5 py-0.5 text-xs font-semibold text-ink-muted">
              {goals.length}
            </span>
          )}
        </div>

        {/* Only the group owner can create goals */}
        {isOwner && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="btn-gold flex items-center gap-1.5 text-sm"
          >
            <Plus className="h-4 w-4" />
            New goal
          </button>
        )}
      </div>

      {/* Goals list */}
      {goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-cream-dark bg-cream-paper/60 px-8 py-12 text-center">
          <p className="font-serif text-base font-semibold text-ink">No group goals yet</p>
          {isOwner ? (
            <>
              <p className="mt-1 max-w-xs text-sm text-ink-muted">
                Create the first goal to give members something to work toward together.
              </p>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="btn-gold mt-4 flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Create first goal
              </button>
            </>
          ) : (
            <p className="mt-1 max-w-xs text-sm text-ink-muted">
              The group owner hasn&apos;t created any goals yet. Check back soon.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => (
            <GroupGoalCard
              key={goal.id}
              goal={goal}
              groupId={groupId}
              isMember={isMember}
              isAdminOrOwner={isAdminOrOwner}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {modalOpen && (
        <CreateGroupGoalModal
          groupId={groupId}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
