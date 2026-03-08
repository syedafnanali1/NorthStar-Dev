// src/app/circle/circle-feed.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn, relativeTime, initials } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";

interface PostData {
  id: string;
  text: string;
  goalId: string | null;
  visibility: string;
  reactionCounts: Record<string, number>;
  replyCount: number;
  createdAt: Date;
  author: { id: string | null; name: string | null; image: string | null; streak: number } | null;
  goalTitle: string | null;
}

interface CircleMember {
  id: string;
  name: string | null;
  image: string | null;
  streak: number;
  momentumScore: number;
}

interface LeaderboardUser {
  id: string;
  name: string | null;
  image: string | null;
  streak: number;
  score: number;
}

interface CircleFeedProps {
  currentUserId: string;
  circleMembers: CircleMember[];
  userGoals: { id: string; title: string; emoji: string | null }[];
  circlePosts: PostData[];
  communityPosts: PostData[];
  leaderboard: LeaderboardUser[];
}

const REACTIONS = ["🔥", "💪", "✨", "💙", "⭐"];

export function CircleFeed({
  currentUserId,
  circleMembers,
  userGoals,
  circlePosts,
  communityPosts,
  leaderboard,
}: CircleFeedProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"circle" | "community" | "mine">("circle");
  const [postText, setPostText] = useState("");
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [visibility, setVisibility] = useState<"circle" | "community">("circle");
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    if (!postText.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch("/api/circle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: postText.trim(),
          goalId: selectedGoalId || null,
          visibility,
        }),
      });
      if (!res.ok) throw new Error();
      toast("Posted ✓");
      setPostText("");
      setSelectedGoalId("");
      router.refresh();
    } catch {
      toast("Failed to post", "error");
    } finally {
      setPosting(false);
    }
  };

  const displayPosts = activeTab === "community" ? communityPosts : circlePosts;

  return (
    <div className="space-y-6">
      {/* Circle members row */}
      <div className="card p-4">
        <p className="text-2xs uppercase tracking-widest text-ink-muted mb-3">
          My Accountability Circle
        </p>
        <div className="flex gap-3 flex-wrap">
          {/* Self */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center text-sm font-bold text-ink">
              You
            </div>
            <span className="text-2xs text-ink-muted">You</span>
          </div>
          {circleMembers.map((m) => (
            <div key={m.id} className="flex flex-col items-center gap-1">
              <div
                className="w-10 h-10 rounded-full bg-gold/50 flex items-center justify-center text-sm font-bold text-ink overflow-hidden"
              >
                {m.image
                  ? <img src={m.image} alt={m.name ?? ""} className="w-full h-full object-cover" />
                  : initials(m.name)}
              </div>
              <span className="text-2xs text-ink-muted truncate max-w-[48px]">{m.name?.split(" ")[0]}</span>
              {m.streak > 0 && <span className="text-2xs text-gold">🔥{m.streak}</span>}
            </div>
          ))}
          {circleMembers.length === 0 && (
            <p className="text-xs text-ink-muted italic">
              Invite friends to grow your circle.
            </p>
          )}
        </div>
      </div>

      {/* Post composer */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center text-xs font-bold text-ink">
            Me
          </div>
          <select
            value={selectedGoalId}
            onChange={(e) => setSelectedGoalId(e.target.value)}
            className="text-xs border-none bg-transparent text-ink-muted cursor-pointer outline-none"
          >
            <option value="">No goal</option>
            {userGoals.map((g) => (
              <option key={g.id} value={g.id}>{g.emoji} {g.title}</option>
            ))}
          </select>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as "circle" | "community")}
            className="ml-auto text-xs border-none bg-transparent text-ink-muted cursor-pointer outline-none"
          >
            <option value="circle">Circle only</option>
            <option value="community">Community</option>
          </select>
        </div>
        <textarea
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
          placeholder="Share a check-in with your circle..."
          className="w-full resize-none bg-transparent text-sm text-ink placeholder:text-ink-muted outline-none h-16"
          maxLength={500}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-2xs text-ink-muted">{postText.length}/500</span>
          <button
            onClick={handlePost}
            disabled={!postText.trim() || posting}
            className="btn-primary text-xs px-5 py-2 disabled:opacity-40"
          >
            {posting ? "Posting..." : "Post update →"}
          </button>
        </div>
      </div>

      {/* Feed tabs */}
      <div className="flex border-b border-cream-dark">
        {(["circle", "community", "mine"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-5 py-3 text-sm font-medium capitalize transition-all border-b-2 -mb-px",
              activeTab === tab
                ? "border-ink text-ink"
                : "border-transparent text-ink-muted hover:text-ink"
            )}
          >
            {tab === "mine" ? "My Updates" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Posts */}
      <div className="space-y-4">
        {displayPosts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-sm text-ink-muted">
              {activeTab === "circle"
                ? "No posts yet. Be the first to share."
                : "No community posts yet."}
            </p>
          </div>
        ) : (
          displayPosts.map((post) => (
            <PostCard key={post.id} post={post} currentUserId={currentUserId} />
          ))
        )}
      </div>

      {/* Leaderboard */}
      <div
        className="rounded-2xl p-5"
        style={{ background: "#1A1714", border: "1px solid #2A2522" }}
      >
        <p className="text-2xs uppercase tracking-widest mb-1" style={{ color: "rgba(232,201,122,0.45)" }}>
          North Star App
        </p>
        <h3 className="font-serif text-white text-lg mb-1">Top 10 Leaderboard 🏆</h3>
        <p className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.25)" }}>
          Ranked by momentum score
        </p>
        <div className="space-y-2">
          {leaderboard.map((u, i) => {
            const isYou = u.id === currentUserId;
            return (
              <div
                key={u.id}
                className={cn(
                  "flex items-center gap-3 py-2 px-3 rounded-xl transition-all",
                  isYou && "ring-1 ring-gold/30"
                )}
                style={isYou ? { background: "rgba(196,150,58,0.09)" } : {}}
              >
                <span
                  className={cn(
                    "text-xs font-bold w-5 text-center font-mono",
                    i === 0 ? "text-gold" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-600" : "text-white/30"
                  )}
                >
                  {i + 1}
                </span>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-ink overflow-hidden flex-shrink-0"
                  style={{ background: "#C4963A" }}
                >
                  {u.image
                    ? <img src={u.image} alt={u.name ?? ""} className="w-full h-full object-cover" />
                    : initials(u.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: isYou ? "#E8C97A" : "rgba(255,255,255,0.8)" }}>
                    {isYou ? "You" : u.name}
                  </div>
                  {u.streak > 0 && (
                    <div className="text-2xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                      🔥 {u.streak} streak
                    </div>
                  )}
                </div>
                <span className="text-xs font-mono font-bold" style={{ color: "#E8C97A" }}>
                  {u.score}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PostCard({ post, currentUserId }: { post: PostData; currentUserId: string }) {
  const [reactions, setReactions] = useState<Record<string, number>>(post.reactionCounts ?? {});
  const [reacting, setReacting] = useState(false);

  const handleReact = async (emoji: string) => {
    if (reacting) return;
    setReacting(true);
    // Optimistic update
    setReactions((prev) => ({ ...prev, [emoji]: (prev[emoji] ?? 0) + 1 }));
    try {
      await fetch(`/api/circle/${post.id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
    } catch {
      setReactions(reactions);
    } finally {
      setReacting(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="flex gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-ink overflow-hidden flex-shrink-0"
          style={{ background: "#C4963A" }}
        >
          {post.author?.image
            ? <img src={post.author.image} alt={post.author.name ?? ""} className="w-full h-full object-cover" />
            : initials(post.author?.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">
              {post.author?.id === currentUserId ? "You" : post.author?.name}
            </span>
            {post.goalTitle && (
              <span className="badge bg-cream text-ink-muted border border-cream-dark">
                {post.goalTitle}
              </span>
            )}
          </div>
          <span className="text-2xs text-ink-muted">{relativeTime(post.createdAt)}</span>
        </div>
      </div>

      <p className="text-sm text-ink-soft italic leading-relaxed mb-4">
        &ldquo;{post.text}&rdquo;
      </p>

      <div className="flex items-center gap-2">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleReact(emoji)}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all",
              "border border-cream-dark hover:border-ink-muted hover:bg-cream"
            )}
          >
            {emoji}
            {(reactions[emoji] ?? 0) > 0 && (
              <span className="text-ink-muted font-mono">{reactions[emoji]}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
