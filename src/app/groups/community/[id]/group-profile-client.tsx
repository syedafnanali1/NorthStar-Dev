"use client";

// src/app/groups/community/[id]/group-profile-client.tsx
// Client interactions for the public group profile:
//   - Request to Join button with pending state
//   - Rate this group (members only)
//   - Leave group (non-owner members only)
//   - Archive group (owner only)
//   - Change group icon (owner only)

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Star, Archive, Pencil, LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils/index";
import { toast } from "@/components/ui/toaster";
import { GroupIconPicker, GroupIconDisplay } from "@/components/group-goals/group-icon-picker";

interface GroupProfileClientProps {
  groupId: string;
  groupName: string;
  myRole: "owner" | "admin" | "member" | null;
  myJoinRequestStatus: "pending" | "approved" | "rejected" | null;
  groupType: "public" | "private";
  myRecommendationRating: number | null;
  currentIcon?: string | null;
}

function LeaveConfirmModal({
  groupName,
  onConfirm,
  onCancel,
  busy,
}: {
  groupName: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-t-3xl bg-cream-paper p-6 shadow-xl sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100">
            <LogOut className="h-5 w-5 text-rose-600" />
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-cream-dark"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="font-serif text-lg font-bold text-ink">Leave {groupName}?</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
          You&apos;ll lose access to shared goals and group activity. You can rejoin later if it&apos;s a public group.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full border border-cream-dark px-4 py-2.5 text-sm font-semibold text-ink-muted transition hover:bg-cream-dark"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-full bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
          >
            {busy ? "Leaving…" : "Leave"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function GroupProfileClient({
  groupId,
  groupName,
  myRole,
  myJoinRequestStatus,
  groupType,
  myRecommendationRating,
  currentIcon,
}: GroupProfileClientProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const [savedRating, setSavedRating] = useState(myRecommendationRating);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [icon, setIcon] = useState<string | null | undefined>(currentIcon);
  const [pickerOpen, setPickerOpen] = useState(false);

  async function handleRequestJoin() {
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/join`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to send request");
      }
      toast("Join request sent! The group admin will review it.", "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to send request", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleRate(rating: number) {
    setRatingBusy(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to save rating");
      }
      setSavedRating(rating);
      toast("Rating saved — thank you!", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save rating", "error");
    } finally {
      setRatingBusy(false);
    }
  }

  async function handleLeave() {
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/leave`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to leave group");
      }
      toast("You have left the group.", "success");
      router.push("/groups");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to leave group", "error");
      setBusy(false);
    }
  }

  async function handleArchive() {
    if (!confirm("Archive this group? This cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to archive");
      toast("Group archived.", "success");
      router.push("/groups");
    } catch {
      toast("Failed to archive group", "error");
    } finally {
      setBusy(false);
    }
  }

  // ── Non-member action ──────────────────────────────────────────────────────
  if (!myRole) {
    if (groupType === "private") {
      return (
        <div className="flex items-center gap-2 rounded-2xl border border-cream-dark bg-cream-dark/50 px-4 py-3">
          <span className="text-sm text-ink-muted">
            🔒 This group is <strong className="text-ink">private</strong> — invite only.
          </span>
        </div>
      );
    }

    const isPending = myJoinRequestStatus === "pending";
    const wasRejected = myJoinRequestStatus === "rejected";

    return (
      <button
        type="button"
        onClick={() => void handleRequestJoin()}
        disabled={busy || isPending}
        className={cn(
          "flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all",
          isPending
            ? "bg-cream-dark text-ink-muted"
            : "bg-ink text-cream-paper hover:opacity-90 active:scale-95"
        )}
      >
        <LogIn className="h-4 w-4" />
        {isPending
          ? "Request Pending…"
          : wasRejected
            ? "Request Again"
            : busy
              ? "Sending…"
              : "Request to Join"}
      </button>
    );
  }

  // ── Member actions ─────────────────────────────────────────────────────────
  const displayRating = hoverRating || savedRating || 0;

  return (
    <>
    {/* Leave modal */}
    {showLeaveModal && (
      <LeaveConfirmModal
        groupName={groupName}
        onConfirm={() => void handleLeave()}
        onCancel={() => setShowLeaveModal(false)}
        busy={busy}
      />
    )}

    {/* Icon picker modal */}
    {pickerOpen && (
      <GroupIconPicker
        groupId={groupId}
        currentIcon={icon}
        onClose={() => setPickerOpen(false)}
        onSaved={(newIcon) => { setIcon(newIcon); router.refresh(); }}
      />
    )}

    <div className="flex flex-wrap items-start gap-4">
      {/* Star rating */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-ink-muted">
          {savedRating ? "Your rating" : "Rate this group"}
        </p>
        <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
          {Array.from({ length: 5 }).map((_, i) => {
            const val = i + 1;
            return (
              <button
                key={val}
                type="button"
                disabled={ratingBusy}
                onMouseEnter={() => setHoverRating(val)}
                onClick={() => void handleRate(val)}
                aria-label={`Rate ${val} out of 5`}
                className="p-0.5 transition-transform hover:scale-125 disabled:opacity-50"
              >
                <Star
                  className={cn(
                    "h-5 w-5 transition-colors",
                    val <= displayRating
                      ? "fill-gold text-gold"
                      : "fill-transparent text-cream-dark"
                  )}
                />
              </button>
            );
          })}
          {savedRating && (
            <span className="ml-1 text-xs text-ink-muted">{savedRating}/5</span>
          )}
        </div>
      </div>

      {/* Leave group (non-owner members) */}
      {myRole !== "owner" && (
        <div className="self-end">
          <button
            type="button"
            onClick={() => setShowLeaveModal(true)}
            className="flex items-center gap-2 rounded-full border border-cream-dark px-4 py-2 text-sm text-ink-muted transition hover:border-rose-300 hover:text-rose-600"
          >
            <LogOut className="h-3.5 w-3.5" />
            Leave Group
          </button>
        </div>
      )}

      {/* Owner controls */}
      {myRole === "owner" && (
        <div className="flex items-center gap-2 self-end">
          {/* Change icon */}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-2 rounded-full border border-cream-dark px-4 py-2 text-sm text-ink-muted transition hover:border-gold hover:text-gold"
          >
            <GroupIconDisplay icon={icon} size="sm" />
            <Pencil className="h-3.5 w-3.5" />
            Change Icon
          </button>

          {/* Archive */}
          <button
            type="button"
            onClick={() => void handleArchive()}
            disabled={busy}
            className="flex items-center gap-2 rounded-full border border-cream-dark px-4 py-2 text-sm text-ink-muted transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-40"
          >
            <Archive className="h-4 w-4" />
            Archive
          </button>
        </div>
      )}
    </div>
    </>
  );
}
