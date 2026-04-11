"use client";

// src/app/groups/community/[id]/group-chat-post.tsx
// Single post card with inline reactions, collapsible comment thread.

import { useState, useRef, useEffect } from "react";
import { MessageCircle, ChevronDown, ChevronUp, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ChatPostWithMeta, ChatCommentWithAuthor } from "@/server/services/group-chat.service";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_EMOJIS = ["👏", "🔥", "💪", "❤️", "🎯"];
const MAX_WORDS = 100;

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function timeAgo(date: Date) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, image, size = "md" }: { name: string | null; image: string | null; size?: "sm" | "md" }) {
  const initials = (name ?? "?").slice(0, 2).toUpperCase();
  const dim = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  if (image) {
    return (
      <img
        src={image}
        alt={name ?? ""}
        className={`${dim} rounded-full object-cover flex-shrink-0`}
      />
    );
  }
  return (
    <div className={`${dim} rounded-full bg-gold/20 text-gold font-semibold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ─── Comment Item ──────────────────────────────────────────────────────────────

function CommentItem({ comment }: { comment: ChatCommentWithAuthor }) {
  const profileHref = comment.author.username
    ? `/profile/${comment.author.username}`
    : "#";
  return (
    <div className="flex gap-2.5 py-2">
      <Avatar name={comment.author.name} image={comment.author.image} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl bg-cream-dark/60 px-3.5 py-2.5">
          <a href={profileHref} className="font-semibold text-ink text-xs hover:underline">
            {comment.author.name ?? comment.author.username ?? "Member"}
          </a>
          <p className="text-sm text-ink mt-0.5 leading-relaxed whitespace-pre-wrap break-words">
            {comment.content}
          </p>
        </div>
        <span className="ml-3 text-xs text-ink-muted mt-0.5 block">{timeAgo(comment.createdAt)}</span>
      </div>
    </div>
  );
}

// ─── Comment Thread ────────────────────────────────────────────────────────────

function CommentThread({
  postId,
  groupId,
  isMember,
}: {
  postId: string;
  groupId: string;
  isMember: boolean;
}) {
  const router = useRouter();
  const [comments, setComments] = useState<ChatCommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/groups/${groupId}/chat/${postId}/comments`)
      .then((r) => r.json())
      .then((d: { comments?: ChatCommentWithAuthor[] }) => {
        if (!cancelled) setComments(d.comments ?? []);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [postId, groupId]);

  const words = countWords(value);
  const overLimit = words > MAX_WORDS;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || overLimit || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/chat/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: value.trim() }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { comment: ChatCommentWithAuthor };
      setComments((prev) => [...prev, data.comment]);
      setValue("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pt-1 pb-0.5 border-t border-cream-dark/50 mt-2">
      {loading ? (
        <p className="text-xs text-ink-muted py-3 text-center">Loading comments…</p>
      ) : (
        <>
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} />
          ))}
          {comments.length === 0 && (
            <p className="text-xs text-ink-muted py-2 text-center">No comments yet. Be the first!</p>
          )}
        </>
      )}

      {isMember && (
        <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Write a comment…"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            className="flex-1 resize-none rounded-xl border border-cream-dark bg-white/60 px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-gold/40 leading-snug"
          />
          <button
            type="submit"
            disabled={!value.trim() || overLimit || submitting}
            className="self-end rounded-xl bg-gold px-3 py-2 text-ink hover:bg-gold/80 disabled:opacity-40 transition-opacity"
            aria-label="Submit comment"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}
      {overLimit && (
        <p className="text-xs text-red-500 mt-1">{words}/{MAX_WORDS} words — over limit</p>
      )}
    </div>
  );
}

// ─── Post Card ─────────────────────────────────────────────────────────────────

interface GroupChatPostProps {
  post: ChatPostWithMeta;
  groupId: string;
  isMember: boolean;
}

export function GroupChatPost({ post, groupId, isMember }: GroupChatPostProps) {
  const router = useRouter();
  const [reactions, setReactions] = useState(post.reactions);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const profileHref = post.author.username
    ? `/profile/${post.author.username}`
    : "#";

  async function handleReact(emoji: string) {
    if (!isMember) return;
    // Optimistic update
    const alreadyReacted = reactions.find((r) => r.emoji === emoji)?.reactedByMe ?? false;
    setReactions((prev) => {
      const exists = prev.find((r) => r.emoji === emoji);
      if (alreadyReacted) {
        const updated = prev.map((r) =>
          r.emoji === emoji ? { ...r, count: r.count - 1, reactedByMe: false } : r
        );
        return updated.filter((r) => r.count > 0);
      }
      if (exists) {
        return prev.map((r) =>
          r.emoji === emoji ? { ...r, count: r.count + 1, reactedByMe: true } : r
        );
      }
      return [...prev, { emoji, count: 1, reactedByMe: true }];
    });

    try {
      const res = await fetch(`/api/groups/${groupId}/chat/${post.id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const data = (await res.json()) as { reactions: typeof reactions };
        setReactions(data.reactions);
        router.refresh();
      }
    } catch {
      // revert on error
      router.refresh();
    }
  }

  function toggleComments() {
    setCommentsOpen((o) => !o);
  }

  return (
    <article className="rounded-2xl border border-cream-dark bg-white/70 p-4 shadow-sm">
      {/* Author row */}
      <div className="flex items-start gap-3">
        <a href={profileHref}>
          <Avatar name={post.author.name} image={post.author.image} />
        </a>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a href={profileHref} className="font-semibold text-sm text-ink hover:underline">
              {post.author.name ?? post.author.username ?? "Member"}
            </a>
            <span className="text-xs text-ink-muted">{timeAgo(post.createdAt)}</span>
          </div>
          <p className="mt-1.5 text-sm text-ink leading-relaxed whitespace-pre-wrap break-words">
            {post.content}
          </p>
        </div>
      </div>

      {/* Reaction bar */}
      <div className="mt-3 flex items-center gap-1 flex-wrap">
        {/* Existing reactions with counts */}
        {reactions.map((r) => (
          <button
            key={r.emoji}
            type="button"
            onClick={() => void handleReact(r.emoji)}
            disabled={!isMember}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium transition-colors
              ${r.reactedByMe
                ? "bg-gold/20 text-ink ring-1 ring-gold/40"
                : "bg-cream-dark/60 text-ink hover:bg-cream-dark"
              } disabled:cursor-default`}
          >
            <span>{r.emoji}</span>
            <span className="text-xs">{r.count}</span>
          </button>
        ))}

        {/* Add reaction: show emoji picker inline */}
        {isMember && (
          <div className="flex gap-1 ml-1">
            {ALLOWED_EMOJIS.filter(
              (em) => !reactions.find((r) => r.emoji === em && r.reactedByMe)
            ).map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => void handleReact(em)}
                className="rounded-full p-1 text-sm hover:bg-cream-dark/60 transition-colors opacity-50 hover:opacity-100"
                title={`React with ${em}`}
              >
                {em}
              </button>
            ))}
          </div>
        )}

        {/* Comment toggle */}
        <button
          type="button"
          onClick={toggleComments}
          className="ml-auto flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          <span>{commentCount > 0 ? commentCount : "Comment"}</span>
          {commentsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Comments */}
      {commentsOpen && (
        <CommentThread
          postId={post.id}
          groupId={groupId}
          isMember={isMember}
        />
      )}
    </article>
  );
}
