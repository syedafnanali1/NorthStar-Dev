"use client";

// src/app/groups/new/page.tsx
// Thin page that opens CreateGroupModal immediately (redirect-style UX)

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreateGroupModal } from "@/components/group-goals/create-group-modal";

export default function NewGroupPage() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  function handleClose() {
    setOpen(false);
    router.push("/groups");
  }

  return (
    <div className="min-h-screen">
      <CreateGroupModal open={open} onClose={handleClose} />
    </div>
  );
}
