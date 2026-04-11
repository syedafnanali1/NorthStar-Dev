"use client";

// src/app/dashboard/compound-view-button.tsx
// Client component holding state for the 1% Compound View modal

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { CompoundView } from "@/components/ui/compound-view";

export function CompoundViewButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-ghost hidden items-center gap-1.5 rounded-full border border-cream-dark px-4 text-sm text-ink-muted transition hover:border-ink hover:text-ink lg:inline-flex"
      >
        <Sparkles className="h-3.5 w-3.5" />
        The 1% View
      </button>
      <CompoundView isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
