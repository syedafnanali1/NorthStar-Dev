"use client";

// src/app/groups/community/[id]/group-profile-client.tsx
// Client interactions for the public group profile:
//   - Request to Join button with pending state
//   - Rate this group (members only)
//   - Archive group (owner only)
//   - Change group icon (owner only)

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Star, Archive, Pencil } from "lucide-react";
import { cn } from "@/lib/utils/index";
import { toast } from "@/components/ui/toaster";
import { GroupIconPicker, GroupIconDisplay } from "@/components/group-goals/group-icon-picker";

interface GroupProfileClientProps {
  groupId: string;
  myRole: "owner" | "admin" | "member" | null;
  myJoinRequestStatus: "pending" | "approved" | "rejected" | null;
  groupType: "public" | "private";
  myRecommendationRating: number | null;
  currentIcon?: string | null;
}

export function GroupProfileClient({
  groupId,
  myRole,
  myJoinRequestStatus,
  groupType,
  myRecommendationRating,
  currentIcon,
}: GroupProfileClientProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
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
