"use client";

// src/app/groups/community/[id]/community-join-requests.tsx
// Join request moderation panel for the new-model (community) groups.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Users, CheckCheck, XCircle } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { cn, initials } from "@/lib/utils/index";
import type { JoinRequestWithUser } from "@/server/services/groups.service";

interface CommunityJoinRequestsProps {
  groupId: string;
  requests: JoinRequestWithUser[];
}

export function CommunityJoinRequests({ groupId, requests }: CommunityJoinRequestsProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const showBulk = requests.length >= 10 || (requests.length > 1 && selected.size > 0);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function reviewRequest(requestId: string, action: "approve" | "reject") {
    setBusyId(requestId);
    try {
      const res = await fetch(`/api/groups/${groupId}/requests`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to review request");
      }
      toast(action === "approve" ? "Request approved." : "Request rejected.", "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to review request", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function bulkReview(action: "approve" | "reject") {
    const ids = selected.size > 0 ? [...selected] : requests.map((r) => r.id);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/groups/${groupId}/requests`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestId: id, action }),
          })
        )
      );
      toast(
        action === "approve"
          ? `${ids.length} request${ids.length > 1 ? "s" : ""} approved.`
          : `${ids.length} request${ids.length > 1 ? "s" : ""} rejected.`,
        "success"
      );
      setSelected(new Set());
      router.refresh();
    } catch {
      toast("Failed to process some requests.", "error");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-cream-dark bg-cream-paper shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-cream-dark px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink">
            <Users className="h-3.5 w-3.5 text-cream-paper" />
          </div>
          <h2 className="font-serif text-lg font-semibold text-ink">Join Requests</h2>
          {requests.length > 0 && (
            <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-gold">
              {requests.length} pending
            </span>
          )}
        </div>

        {/* Bulk actions */}
        {showBulk && requests.length > 0 && (
          <div className="flex items-center gap-2">
            {selected.size === 0 ? (
              <button
                type="button"
                onClick={() => setSelected(new Set(requests.map((r) => r.id)))}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-cream-dark hover:text-ink"
              >
                Select all
              </button>
            ) : (
              <>
                <span className="text-xs text-ink-muted">{selected.size} selected</span>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="rounded-lg p-1.5 text-ink-muted hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void bulkReview("approve")}
              className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-cream-paper transition hover:opacity-90 disabled:opacity-40"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {selected.size > 0 ? `Approve ${selected.size}` : "Approve all"}
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void bulkReview("reject")}
              className="flex items-center gap-1.5 rounded-lg border border-cream-dark px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-40"
            >
              <XCircle className="h-3.5 w-3.5" />
              {selected.size > 0 ? `Reject ${selected.size}` : "Reject all"}
            </button>
          </div>
        )}
      </div>

      {/* Request list */}
      {requests.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-ink-muted">No pending join requests.</p>
        </div>
      ) : (
        <div className="divide-y divide-cream-dark">
          {requests.map((req) => {
            const name = req.requester.name ?? req.requester.username ?? "Member";
            const isBusy = busyId === req.id;
            const isSelected = selected.has(req.id);

            return (
              <div
                key={req.id}
                className={cn(
                  "flex items-center gap-3 px-5 py-3.5 transition-colors",
                  isSelected && "bg-cream"
                )}
              >
                {showBulk && (
                  <button
                    type="button"
                    onClick={() => toggleSelect(req.id)}
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] transition",
                      isSelected
                        ? "border-ink bg-ink text-cream-paper"
                        : "border-cream-dark bg-cream-paper text-transparent hover:border-ink-muted"
                    )}
                  >
                    <Check className="h-3 w-3" />
                  </button>
                )}

                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold text-xs font-bold text-ink">
                  {req.requester.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={req.requester.image}
                      alt={name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials(name)
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{name}</p>
                  {req.requester.username && (
                    <p className="truncate text-xs text-ink-muted">@{req.requester.username}</p>
                  )}
                  {req.note && (
                    <p className="mt-0.5 truncate text-xs italic text-ink-muted">
                      &ldquo;{req.note}&rdquo;
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void reviewRequest(req.id, "approve")}
                    className="flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-cream-paper transition hover:opacity-90 disabled:opacity-40"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span className="hidden sm:block">Approve</span>
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void reviewRequest(req.id, "reject")}
                    className="flex items-center gap-1 rounded-full border border-cream-dark px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-40"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span className="hidden sm:block">Reject</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
