"use client";

// src/app/groups/community/[id]/group-chat-feed.tsx
// Chat feed with pinned composer (100-word limit) and chronological post list.

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { GroupChatPost } from "./group-chat-post";
import type { ChatPostWithMeta } from "@/server/services/group-chat.service";

const MAX_WORDS = 100;

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ─── Composer ─────────────────────────────────────────────────────────────────

function PostComposer({
  groupId,
  onPosted,
}: {
  groupId: string;
  onPosted: (post: ChatPostWithMeta) => void;
}) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const words = countWords(value);
  const overLimit = words > MAX_WORDS;
  const remaining = MAX_WORDS - words;

  function autoResize() {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!value.trim() || overLimit || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: value.trim() }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { post: ChatPostWithMeta };
      onPosted(data.post);
      setValue("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="sticky top-0 z-10 rounded-2xl border border-cream-dark bg-cream-paper shadow-sm p-3.5"
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => { setValue(e.target.value); autoResize(); }}
        placeholder="Share an update with the group…"
        rows={2}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSubmit();
          }
        }}
        className="w-full resize-none bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none leading-relaxed"
      />
      <div className="mt-2 flex items-center justify-between">
        <span
          className={`text-xs ${
            overLimit ? "text-red-500 font-semibold" : remaining <= 20 ? "text-amber-600" : "text-ink-muted"
          }`}
        >
          {overLimit ? `${words}/${MAX_WORDS} words — over limit` : `${remaining} words left`}
        </span>
        <button
          type="submit"
          disabled={!value.trim() || overLimit || submitting}
          className="btn-gold flex items-center gap-1.5 text-sm disabled:opacity-40"
        >
          {submitting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Post
        </button>
      </div>
    </form>
  );
}

// ─── Feed ──────────────────────────────────────────────────────────────────────

interface GroupChatFeedProps {
  groupId: string;
  initialPosts: ChatPostWithMeta[];
  isMember: boolean;
}

export function GroupChatFeed({ groupId, initialPosts, isMember }: GroupChatFeedProps) {
  const router = useRouter();
  const [posts, setPosts] = useState<ChatPostWithMeta[]>(initialPosts);

  // Re-sync when server data changes (e.g., after a refresh from another tab)
  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  function handlePosted(newPost: ChatPostWithMeta) {
    setPosts((prev) => [newPost, ...prev]);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Composer: only visible to members */}
      {isMember && (
        <PostComposer groupId={groupId} onPosted={handlePosted} />
      )}

      {/* Feed */}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-cream-dark bg-cream-paper/60 px-8 py-14 text-center">
          <p className="font-serif text-lg font-semibold text-ink">No posts yet</p>
          {isMember ? (
            <p className="mt-1 text-sm text-ink-muted max-w-xs">
              Be the first to share an update with the group above.
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink-muted max-w-xs">
              Join the group to see and participate in discussions.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <GroupChatPost
              key={post.id}
              post={post}
              groupId={groupId}
              isMember={isMember}
            />
          ))}
        </div>
      )}
    </div>
  );
}
