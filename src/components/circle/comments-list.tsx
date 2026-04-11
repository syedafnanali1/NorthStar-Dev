"use client";

// src/components/circle/comments-list.tsx

import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { cn, initials } from "@/lib/utils/index";
import { Send, Trash2 } from "lucide-react";

interface CommentData {
  id: string;
  parentCommentId: string | null;
  text: string;
  isDeleted: boolean;
  createdAt: string;
  userId: string;
  authorName: string | null;
  authorImage: string | null;
  replies: CommentData[];
}

interface CommentsListProps {
  postId: string;
  currentUserId: string;
  onCountChange?: (count: number) => void;
}

export function CommentsList({ postId, currentUserId, onCountChange }: CommentsListProps) {
  const [items, setItems] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function fetchComments() {
    setLoading(true);
    try {
      const res = await fetch(`/api/circle/${postId}/comments`);
      if (!res.ok) return;
      const data = (await res.json()) as { comments: CommentData[]; total: number };
      setItems(data.comments);
      onCountChange?.(data.total);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!text.trim() || submitting) return;
    setSubmitting(true);

    const body = { text: text.trim(), parentCommentId: replyingTo ?? undefined };

    // Optimistic update
    const optimistic: CommentData = {
      id: `opt_${Date.now()}`,
      parentCommentId: replyingTo,
      text: text.trim(),
      isDeleted: false,
      createdAt: new Date().toISOString(),
      userId: currentUserId,
      authorName: "You",
      authorImage: null,
      replies: [],
    };

    if (replyingTo) {
      setItems((prev) =>
        prev.map((c) =>
          c.id === replyingTo ? { ...c, replies: [...c.replies, optimistic] } : c
        )
      );
    } else {
      setItems((prev) => [...prev, optimistic]);
    }
    // will be corrected by fetchComments after submit

    try {
      const res = await fetch(`/api/circle/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setText("");
        setReplyingTo(null);
        void fetchComments(); // refresh to get real IDs
      }
    } catch {
      // revert on error
      void fetchComments();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
    void fetchComments();
  }

  function handleReply(commentId: string, authorName: string | null) {
    setReplyingTo(commentId);
    setText(`@${authorName ?? "user"} `);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  if (loading) {
    return (
      <div className="space-y-2 py-3">
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-2">
            <div className="h-7 w-7 flex-shrink-0 animate-pulse rounded-full bg-cream-dark" />
            <div className="flex-1 space-y-1">
              <div className="h-3 w-24 animate-pulse rounded bg-cream-dark" />
              <div className="h-3 w-48 animate-pulse rounded bg-cream-dark" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-3">
      {items.length === 0 && (
        <p className="py-2 text-xs italic text-ink-muted">No comments yet. Be the first.</p>
      )}

      {items.map((comment) => (
        <div key={comment.id}>
          <CommentItem
            comment={comment}
            currentUserId={currentUserId}
            onDelete={handleDelete}
            onReply={handleReply}
            isReply={false}
          />
          {/* Replies */}
          {comment.replies.length > 0 && (
            <div className="ml-9 mt-2 space-y-2 border-l-2 border-cream-dark pl-3">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  currentUserId={currentUserId}
                  onDelete={handleDelete}
                  onReply={handleReply}
                  isReply
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Comment input */}
      <div className="flex gap-2 pt-1">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-ink">
          Me
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {replyingTo && (
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <span>Replying to thread</span>
              <button
                type="button"
                onClick={() => { setReplyingTo(null); setText(""); }}
                className="text-ink-soft hover:text-ink"
              >
                ✕ Cancel
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a comment..."
              rows={2}
              maxLength={500}
              className="min-h-[52px] w-full resize-none rounded-xl border border-cream-dark bg-cream px-3 py-2 text-xs text-ink outline-none placeholder:text-ink-muted focus:border-ink-muted"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleSubmit();
              }}
            />
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!text.trim() || submitting}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-ink text-cream-paper transition-opacity disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  currentUserId,
  onDelete,
  onReply,
  isReply,
}: {
  comment: CommentData;
  currentUserId: string;
  onDelete: (id: string) => void;
  onReply: (id: string, name: string | null) => void;
  isReply: boolean;
}) {
  const isOwn = comment.userId === currentUserId;
  const avatarSize = isReply ? "h-6 w-6 text-[9px]" : "h-7 w-7 text-[10px]";

  if (comment.isDeleted) {
    return (
      <div className="flex items-center gap-2 py-0.5">
        <div className={cn("flex-shrink-0 rounded-full bg-cream-dark", avatarSize)} />
        <span className="text-xs italic text-ink-muted">[comment removed]</span>
      </div>
    );
  }

  return (
    <div className="group flex gap-2">
      <div className={cn("flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold font-bold text-ink", avatarSize)}>
        {comment.authorImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={comment.authorImage} alt="" className="h-full w-full object-cover" />
        ) : (
          initials(comment.authorName)
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-1.5">
          <span className="text-[11px] font-semibold text-ink">
            {isOwn ? "You" : (comment.authorName ?? "User")}
          </span>
          <span className="text-[10px] text-ink-muted">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{comment.text}</p>
        <div className="mt-1 flex items-center gap-3 opacity-0 transition-opacity group-hover:opacity-100">
          {!isReply && (
            <button
              type="button"
              onClick={() => onReply(comment.id, comment.authorName)}
              className="text-[10px] font-medium text-ink-muted hover:text-ink"
            >
              Reply
            </button>
          )}
          {isOwn && (
            <button
              type="button"
              onClick={() => onDelete(comment.id)}
              className="text-[10px] text-ink-muted hover:text-red-500"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
