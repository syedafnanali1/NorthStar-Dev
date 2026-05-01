"use client";

// src/components/ui/demo-banner.tsx
// Persistent banner shown when the user is in demo mode.
// Always renders above page content; tapping "Sign Up" goes to /auth/register.

import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { useState } from "react";

interface DemoBannerProps {
  isDemo: boolean;
}

export function DemoBanner({ isDemo }: DemoBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!isDemo || dismissed) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-gold/90 backdrop-blur-sm px-4 py-2.5 text-ink">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 flex-shrink-0" />
        <span>
          You&apos;re in Demo Mode —{" "}
          <Link
            href="/auth/register"
            className="underline underline-offset-2 hover:opacity-75"
          >
            Sign up to save your progress
          </Link>
        </span>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss banner"
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full hover:bg-ink/10 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
