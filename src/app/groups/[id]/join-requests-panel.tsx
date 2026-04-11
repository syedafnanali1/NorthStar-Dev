"use client";

// src/app/groups/[id]/join-requests-panel.tsx
// Join request moderation with individual and bulk approve/reject.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Users, CheckCheck, XCircle } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { cn, initials } from "@/lib/utils/index";
import type { JoinRequestWithUser } from "@/server/services/group-goals.service";

interface JoinRequestsPanelProps {
  groupGoalId: string;
  requests: JoinRequestWithUser[];
}

export function JoinRequestsPanel({ groupGoalId, requests }: JoinRequestsPanelProps) {
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

  function selectAll() {
    setSelected(new Set(requests.map((r) => r.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function reviewRequest(requestId: string, action: "approve" | "reject") {
    setBusyId(requestId);
    try {
      const res = await fetch(`/api/group-goals/${groupGoalId}/requests`, {
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
          fetch(`/api/group-goals/${groupGoalId}/requests`, {
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
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cream-dark">
            <Users className="h-3.5 w-3.5 text-ink" />
          </div>
          <h2 className="font-serif text-lg font-semibold text-ink">Join Requests</h2>
          {requests.length > 0 && (
            <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-gold">
              {requests.length} pending
            </span>
          )}
        </div>

        {/* Bulk controls */}
        {showBulk && requests.length > 0 && (
          <div className="flex items-center gap-2">
            {selected.size === 0 ? (
              <button
                type="button"
                onClick={selectAll}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-cream-dark hover:text-ink"
              >
                Select all
              </button>
            ) : (
              <>
                <span className="text-xs text-ink-muted">{selected.size} selected</span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-lg px-2 py-1 text-xs text-ink-muted hover:text-ink"
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

      <div className="overflow-hidden rounded-2xl border border-cream-dark bg-cream-paper">
        {requests.length === 0 ? (
          <div className="px-5 py-6 text-center">
            <p className="text-sm text-ink-muted">No pending requests right now.</p>
          </div>
        ) : (
          <div className="divide-y divide-cream-dark">
            {requests.map((request) => {
              const name = request.requester.name ?? request.requester.username ?? "Member";
              const isBusy = busyId === request.id;
              const isSelected = selected.has(request.id);

              return (
                <div
                  key={request.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 transition-colors",
                    isSelected && "bg-cream"
                  )}
                >
                  {/* Checkbox (shown when bulk mode active or ≥10 requests) */}
                  {showBulk && (
                    <button
                      type="button"
                      onClick={() => toggleSelect(request.id)}
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

                  {/* Avatar */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold text-[10px] font-bold text-ink">
                    {request.requester.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={request.requester.image}
                        alt={name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initials(name)
                    )}
                  </div>

                  {/* Name */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{name}</p>
                    {request.requester.username && (
                      <p className="truncate text-xs text-ink-muted">
                        @{request.requester.username}
                      </p>
                    )}
                    {request.note && (
                      <p className="mt-0.5 truncate text-xs italic text-ink-muted">
                        &quot;{request.note}&quot;
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void reviewRequest(request.id, "approve")}
                      className="flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-cream-paper transition hover:opacity-90 disabled:opacity-40"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span className="hidden sm:block">Approve</span>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void reviewRequest(request.id, "reject")}
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
      </div>
    </section>
  );
}
