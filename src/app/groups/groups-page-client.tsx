"use client";

// src/app/groups/groups-page-client.tsx

import { useState } from "react";
import { Plus } from "lucide-react";
import { CreateGroupModal } from "@/components/group-goals/create-group-modal";
import type { InvitableFriend } from "@/server/services/groups.service";

interface GroupsPageClientProps {
  invitableFriends: InvitableFriend[];
  variant?: "default" | "inline";
}

export function GroupsPageClient({ invitableFriends, variant = "default" }: GroupsPageClientProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "inline"
            ? "btn-secondary flex items-center gap-1.5"
            : "btn-gold flex shrink-0 items-center gap-1.5"
        }
      >
        <Plus className="h-4 w-4" />
        New Group
      </button>
      <CreateGroupModal
        open={open}
        onClose={() => setOpen(false)}
        invitableFriends={invitableFriends}
      />
    </>
  );
}
