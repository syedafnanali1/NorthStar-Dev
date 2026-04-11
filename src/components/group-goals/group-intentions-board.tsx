"use client";

// src/components/group-goals/group-intentions-board.tsx
// Timeline-style intentions board: creator sets intentions by frequency,
// members can comment, submit ideas, and add intentions to their calendar.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  MessageSquare,
  Plus,
  Send,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  CalendarCheck,
} from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { cn, initials, relativeTime } from "@/lib/utils/index";
import type {
  GroupIntention,
  GroupIdeaSubmission,
} from "@/server/services/group-goals.service";

const FREQUENCIES = [
  { value: "daily", label: "Daily", color: "#6B8C7A" },
  { value: "weekly", label: "Weekly", color: "#5B7EA6" },
  { value: "monthly", label: "Monthly", color: "#C4963A" },
  { value: "yearly", label: "Yearly", color: "#7B6FA0" },
  { value: "custom", label: "Custom", color: "#8C857D" },
] as const;

type Frequency = (typeof FREQUENCIES)[number]["value"];

function frequencyConfig(freq: Frequency) {
  return FREQUENCIES.find((f) => f.value === freq) ?? FREQUENCIES[4];
}

function Avatar({ name, image }: { name: string | null; image: string | null }) {
  return (
    <div className="inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold text-[10px] font-bold text-ink">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={name ?? ""} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </div>
  );
}

interface IntentionCardProps {
  intention: GroupIntention;
  groupGoalId: string;
  canInteract: boolean;
  currentUserId: string;
  accentColor: string;
  onCommentAdded: (intentionId: string, comment: GroupIntention["comments"][number]) => void;
}

function IntentionCard({
  intention,
  groupGoalId,
  canInteract,
  currentUserId,
  accentColor,
  onCommentAdded,
}: IntentionCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const cfg = frequencyConfig(intention.frequency);

  async function submitComment() {
    const text = commentText.trim();
    if (!text || commentBusy) return;
    setCommentBusy(true);
    try {
      const res = await fetch(`/api/group-goals/${groupGoalId}/intentions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "comment", intentionId: intention.id, text }),
      });
      if (!res.ok) throw new Error("Failed to post comment");
      const data = (await res.json()) as { message: { id: string; createdAt: string } };
      onCommentAdded(intention.id, {
        id: data.message.id,
        intentionId: intention.id,
        text,
        createdAt: new Date(data.message.createdAt),
        user: { id: currentUserId, name: "You", username: null, image: null },
      });
      setCommentText("");
      setShowComments(true);
    } catch {
      toast("Failed to post comment", "error");
    } finally {
      setCommentBusy(false);
    }
  }

  function addToCalendar() {
    const params = new URLSearchParams({
      title: intention.title,
      note: intention.description ?? "",
      frequency: intention.frequency,
      fromGroup: groupGoalId,
    });
    if (intention.targetDate) params.set("date", intention.targetDate);
    // Navigate to calendar with pre-filled intention
    window.location.href = `/calendar?addGoal=1&${params.toString()}`;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-cream-dark bg-cream-paper transition-all">
      {/* Frequency stripe */}
      <div className="h-0.5 w-full" style={{ background: cfg.color }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `${cfg.color}18`, border: `1.5px solid ${cfg.color}33` }}
          >
            <RefreshCw className="h-4 w-4" style={{ color: cfg.color }} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span
                  className="mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: `${cfg.color}18`, color: cfg.color }}
                >
                  {cfg.label}
                </span>
                <h3 className="font-serif text-base font-semibold leading-tight text-ink">
                  {intention.title}
                </h3>
              </div>
            </div>

            {intention.description && (
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                {intention.description}
              </p>
            )}

            {intention.targetDate && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
                <CalendarDays className="h-3.5 w-3.5" />
                Target: {new Date(intention.targetDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-cream-dark pt-3">
          {/* Add to calendar */}
          {canInteract && (
            <button
              type="button"
              onClick={addToCalendar}
              className="flex items-center gap-1.5 rounded-full bg-cream-dark px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-ink hover:text-cream-paper"
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              Add to my calendar
            </button>
          )}

          {/* Comments toggle */}
          <button
            type="button"
            onClick={() => setShowComments((v) => !v)}
            className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-cream-dark hover:text-ink"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {intention.comments.length > 0
              ? `${intention.comments.length} comment${intention.comments.length > 1 ? "s" : ""}`
              : "Comment"}
            {showComments ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        </div>

        {/* Comments section */}
        {showComments && (
          <div className="mt-3 space-y-3 border-t border-cream-dark pt-3">
            {/* Existing comments */}
            {intention.comments.length === 0 && (
              <p className="text-xs italic text-ink-muted">
                No comments yet. Be the first to share your thoughts.
              </p>
            )}
            {intention.comments.map((comment) => (
              <div key={comment.id} className="flex items-start gap-2.5">
                <Avatar name={comment.user.name} image={comment.user.image} />
                <div className="min-w-0 flex-1 rounded-xl bg-cream px-3 py-2">
                  <p className="text-xs font-semibold text-ink">
                    {comment.user.name ?? comment.user.username ?? "Member"}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink">{comment.text}</p>
                  <p className="mt-1 text-[10px] text-ink-muted">{relativeTime(comment.createdAt)}</p>
                </div>
              </div>
            ))}

            {/* Add comment */}
            {canInteract && (
              <div className="flex items-center gap-2">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void submitComment();
                    }
                  }}
                  placeholder="Add a comment…"
                  className="form-input h-9 flex-1 text-xs"
                  maxLength={500}
                  disabled={commentBusy}
                />
                <button
                  type="button"
                  onClick={() => void submitComment()}
                  disabled={commentBusy || !commentText.trim()}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-cream-paper transition hover:opacity-90 disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface GroupIntentionsBoardProps {
  groupGoalId: string;
  isCreator: boolean;
  canInteract: boolean;
  currentUserId: string;
  initialIntentions: GroupIntention[];
  initialIdeas: GroupIdeaSubmission[];
  accentColor: string;
}

export function GroupIntentionsBoard({
  groupGoalId,
  isCreator,
  canInteract,
  currentUserId,
  initialIntentions,
  initialIdeas,
  accentColor,
}: GroupIntentionsBoardProps) {
  const router = useRouter();
  const [intentions, setIntentions] = useState<GroupIntention[]>(initialIntentions);
  const [ideas, setIdeas] = useState<GroupIdeaSubmission[]>(initialIdeas);

  // Create intention state
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newFreq, setNewFreq] = useState<Frequency>("weekly");
  const [newDate, setNewDate] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  // Idea state
  const [showIdea, setShowIdea] = useState(false);
  const [ideaText, setIdeaText] = useState("");
  const [ideaBusy, setIdeaBusy] = useState(false);

  // Filter by frequency
  const [activeFreq, setActiveFreq] = useState<Frequency | "all">("all");

  function handleCommentAdded(intentionId: string, comment: GroupIntention["comments"][number]) {
    setIntentions((prev) =>
      prev.map((i) =>
        i.id === intentionId ? { ...i, comments: [...i.comments, comment] } : i
      )
    );
  }

  async function createIntention() {
    if (!newTitle.trim() || createBusy) return;
    setCreateBusy(true);
    try {
      const res = await fetch(`/api/group-goals/${groupGoalId}/intentions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "intention",
          title: newTitle.trim(),
          description: newDesc.trim() || undefined,
          frequency: newFreq,
          targetDate: newDate || undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to create intention");
      }
      toast("Intention added!", "success");
      setShowCreate(false);
      setNewTitle("");
      setNewDesc("");
      setNewFreq("weekly");
      setNewDate("");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create intention", "error");
    } finally {
      setCreateBusy(false);
    }
  }

  async function submitIdea() {
    const text = ideaText.trim();
    if (!text || ideaBusy) return;
    setIdeaBusy(true);
    try {
      const res = await fetch(`/api/group-goals/${groupGoalId}/intentions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "idea", text }),
      });
      if (!res.ok) throw new Error("Failed to submit idea");
      const data = (await res.json()) as { message: { id: string; createdAt: string } };
      setIdeas((prev) => [
        ...prev,
        {
          id: data.message.id,
          text,
          createdAt: new Date(data.message.createdAt),
          user: { id: currentUserId, name: "You", username: null, image: null },
        },
      ]);
      toast("Idea submitted to the creator!", "success");
      setIdeaText("");
      setShowIdea(false);
    } catch {
      toast("Failed to submit idea", "error");
    } finally {
      setIdeaBusy(false);
    }
  }

  const filtered =
    activeFreq === "all"
      ? intentions
      : intentions.filter((i) => i.frequency === activeFreq);

  return (
    <div className="space-y-5">
      {/* Header + actions */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-label mb-0.5">Group Intentions</p>
          <p className="text-xs text-ink-muted">
            {isCreator
              ? "Set intentions for the group — daily, weekly, monthly, or yearly."
              : "Intentions set by the creator. Add them to your calendar or comment."}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {!isCreator && canInteract && (
            <button
              type="button"
              onClick={() => setShowIdea((v) => !v)}
              className="flex items-center gap-1.5 rounded-full border border-cream-dark px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-ink-muted hover:text-ink"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Share idea
            </button>
          )}
          {isCreator && (
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-cream-paper transition hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              Add intention
            </button>
          )}
        </div>
      </div>

      {/* Idea submission form */}
      {showIdea && canInteract && !isCreator && (
        <div className="rounded-2xl border border-cream-dark bg-cream p-4">
          <p className="mb-2 text-sm font-semibold text-ink">Share an intention idea with the creator</p>
          <textarea
            value={ideaText}
            onChange={(e) => setIdeaText(e.target.value)}
            placeholder="Suggest an intention or goal idea for the group…"
            className="form-input min-h-[80px] resize-none"
            maxLength={500}
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowIdea(false)}
              className="btn-ghost text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={ideaBusy || !ideaText.trim()}
              onClick={() => void submitIdea()}
              className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-cream-paper transition hover:opacity-90 disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
              Submit idea
            </button>
          </div>
        </div>
      )}

      {/* Create intention form (creator only) */}
      {showCreate && isCreator && (
        <div className="rounded-2xl border border-cream-dark bg-cream p-4 space-y-3">
          <p className="text-sm font-semibold text-ink">New group intention</p>

          {/* Frequency picker */}
          <div className="flex flex-wrap gap-2">
            {FREQUENCIES.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setNewFreq(f.value)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                  newFreq === f.value
                    ? "text-cream-paper shadow-sm"
                    : "bg-cream-dark text-ink-muted hover:text-ink"
                )}
                style={newFreq === f.value ? { background: f.color } : {}}
              >
                {f.label}
              </button>
            ))}
          </div>

          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Intention title (e.g. Morning workout)"
            className="form-input"
            maxLength={120}
            autoFocus
          />
          <textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="form-input min-h-[64px] resize-none"
            maxLength={400}
          />
          <div>
            <label className="form-label">Target date (optional)</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="btn-ghost text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={createBusy || !newTitle.trim()}
              onClick={() => void createIntention()}
              className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-cream-paper transition hover:opacity-90 disabled:opacity-40"
            >
              {createBusy ? "Saving…" : "Add intention"}
            </button>
          </div>
        </div>
      )}

      {/* Frequency filter tabs */}
      {intentions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveFreq("all")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-all",
              activeFreq === "all"
                ? "bg-ink text-cream-paper"
                : "bg-cream-dark text-ink-muted hover:text-ink"
            )}
          >
            All ({intentions.length})
          </button>
          {FREQUENCIES.filter((f) => intentions.some((i) => i.frequency === f.value)).map((f) => {
            const count = intentions.filter((i) => i.frequency === f.value).length;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setActiveFreq(f.value)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-all",
                  activeFreq === f.value
                    ? "text-cream-paper"
                    : "bg-cream-dark text-ink-muted hover:text-ink"
                )}
                style={activeFreq === f.value ? { background: f.color } : {}}
              >
                {f.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Intentions list */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-cream-dark bg-cream-paper px-6 py-10 text-center">
          {intentions.length === 0 ? (
            <>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-dark text-xl">
                ✨
              </div>
              <p className="font-serif text-base font-semibold text-ink">No intentions yet</p>
              <p className="mt-1 text-xs text-ink-muted">
                {isCreator
                  ? "Add the first group intention to guide members."
                  : "The group creator hasn't set any intentions yet."}
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-muted">No intentions for this frequency.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((intention) => (
            <IntentionCard
              key={intention.id}
              intention={intention}
              groupGoalId={groupGoalId}
              canInteract={canInteract}
              currentUserId={currentUserId}
              accentColor={accentColor}
              onCommentAdded={handleCommentAdded}
            />
          ))}
        </div>
      )}

      {/* Idea submissions (creator view) */}
      {isCreator && ideas.length > 0 && (
        <div className="mt-6 rounded-2xl border border-cream-dark bg-cream-paper p-4">
          <p className="section-label mb-3">Member Idea Submissions</p>
          <div className="space-y-3">
            {ideas.map((idea) => (
              <div key={idea.id} className="flex items-start gap-2.5">
                <Avatar name={idea.user.name} image={idea.user.image} />
                <div className="min-w-0 flex-1 rounded-xl bg-cream px-3 py-2">
                  <p className="text-xs font-semibold text-ink">
                    {idea.user.name ?? idea.user.username ?? "Member"}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink">{idea.text}</p>
                  <p className="mt-1 text-[10px] text-ink-muted">{relativeTime(idea.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
