// src/app/groups/discover/page.tsx
// Full-page group discovery: search, sort, and browse all public groups.

import type { Metadata } from "next";
import Link from "next/link";
import { requireAuthUser } from "@/lib/auth/helpers";
import { groupsService } from "@/server/services/groups.service";
import { AppLayout } from "@/components/layout/app-layout";
import { DiscoverClient } from "./discover-client";
import { Compass, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Discover Groups — NorthStar",
};

export default async function DiscoverPage() {
  const user = await requireAuthUser();
  const initialGroups = await groupsService.searchPublicGroups(user.id, "", "popularity");

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* ── Header ── */}
        <div>
          <Link
            href="/groups"
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Groups
          </Link>

          <div className="flex items-end gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink">
              <Compass className="h-6 w-6 text-cream-paper" />
            </div>
            <div>
              <p className="section-label mb-1">Community</p>
              <h1 className="font-serif text-3xl font-semibold text-ink lg:text-4xl">
                Discover Groups
              </h1>
              <p className="mt-1 max-w-lg font-serif text-sm italic leading-relaxed text-ink-muted">
                Find your people. Browse public groups, check their popularity score, and request to join.
              </p>
            </div>
          </div>
        </div>

        {/* ── Discovery grid (client-side search + sort) ── */}
        <DiscoverClient initialGroups={initialGroups} />
      </div>
    </AppLayout>
  );
}
