"use client";

// src/app/groups/[id]/group-detail-client.tsx
// Client actions: log contribution, request to join, archive group (owner)

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart2, LogIn, Archive, X } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils/index";
import type { ViewerJoinRequestStatus } from "@/server/services/group-goals.service";

interface GroupDetailClientProps {
  groupGoalId: string;
  unit?: string;
  isCreator?: boolean;
  canInteract: boolean;
  viewerJoinRequestStatus: ViewerJoinRequestStatus;
  accentColor?: string;
}

export function GroupDetailClient({
  groupGoalId,
  unit,
  isCreator = false,
  canInteract,
  viewerJoinRequestStatus,
  accentColor,
}: GroupDetailClientProps) {
  const router = useRouter();
  const [logOpen, setLogOpen] = useState(false);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLog() {
    const num = Number.parseFloat(value);
    if (!Number.isFinite(num) || num <= 0) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/group-goals/${groupGoalId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: num, note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to log contribution");
      }
      toast("Contribution logged!", "success");
      setLogOpen(false);
      setValue("");
      setNote("");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to log contribution", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestToJoin() {
    setBusy(true);
    try {
      const res = await fetch(`/api/group-goals/${groupGoalId}/join`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to request to join");
      }
      toast("Join request sent. Waiting on owner approval.", "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to request to join", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive() {
    if (!confirm("Archive this group? This cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/group-goals/${groupGoalId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to archive");
      toast("Group archived", "success");
      router.push("/groups");
      router.refresh();
    } catch {
      toast("Failed to archive group", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!canInteract) {
    const requestPending = viewerJoinRequestStatus === "pending";
    return (
      <button
        type="button"
        onClick={() => void handleRequestToJoin()}
        disabled={busy || requestPending}
        className={cn(
          "flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all",
          requestPending
            ? "bg-cream-dark text-ink-muted"
            : "bg-ink text-cream-paper hover:opacity-90"
        )}
      >
        <LogIn className="h-4 w-4" />
        {requestPending ? "Request Pending" : busy ? "Sending…" : "Request to Join"}
      </button>
    );
  }

  return (
    <div className="flex w-full flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setLogOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-cream-paper transition-all hover:opacity-90"
        style={{ background: accentColor ?? "var(--ink)" }}
      >
        <BarChart2 className="h-4 w-4" />
        Log Progress
      </button>

      {isCreator && (
        <button
          type="button"
          onClick={() => void handleArchive()}
          disabled={busy}
          className="flex items-center gap-2 rounded-full border border-cream-dark px-4 py-2.5 text-sm text-ink-muted transition-all hover:border-rose-300 hover:text-rose-600"
        >
          <Archive className="h-4 w-4" />
          Archive
        </button>
      )}

      {logOpen && (
        <div className="mt-1 w-full rounded-2xl border border-cream-dark bg-cream p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Log your contribution</p>
            <button
              type="button"
              onClick={() => setLogOpen(false)}
              className="rounded-lg p-1 text-ink-muted hover:bg-cream-dark hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2">
            <input
              type="number"
              min="0.01"
              step="any"
              className="form-input"
              placeholder={unit ? `Amount in ${unit}` : "Amount"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
            <input
              className="form-input"
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void handleLog()}
              disabled={busy || !value}
              className="rounded-full px-5 py-2 text-sm font-semibold text-cream-paper transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: accentColor ?? "var(--ink)" }}
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setLogOpen(false)}
              className="btn-ghost text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
