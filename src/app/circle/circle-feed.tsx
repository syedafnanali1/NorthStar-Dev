"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageCircle, Send } from "lucide-react";
import { cn, initials, relativeTime } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import { CommentsList } from "@/components/circle/comments-list";

interface PostData {
  id: string;
  text: string;
  goalId: string | null;
  visibility: string;
  reactionCounts: Record<string, number>;
  replyCount: number;
  createdAt: Date;
  author: {
    id: string | null;
    name: string | null;
    username: string | null;
    image: string | null;
    streak: number;
  } | null;
  goalTitle: string | null;
}

interface CircleMember {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  streak: number;
  momentumScore: number;
}

interface LeaderboardUser {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  streak: number;
  score: number;
}

interface CircleStats {
  members: number;
  weeklyPosts: number;
  activeStreaks: number;
  publicPosts: number;
}

interface CircleFeedProps {
  currentUserId: string;
  circleMembers: CircleMember[];
  userGoals: { id: string; title: string; emoji: string | null }[];
  circlePosts: PostData[];
  communityPosts: PostData[];
  leaderboard: LeaderboardUser[];
  circleStats: CircleStats;
}

const REACTIONS = ["🔥", "💪", "💙", "✨"] as const;

export function CircleFeed({
  currentUserId,
  circleMembers,
  userGoals,
  circlePosts,
  communityPosts,
  leaderboard,
  circleStats,
}: CircleFeedProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"circle" | "community" | "mine">("circle");
  const [postText, setPostText] = useState("");
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [visibility, setVisibility] = useState<"circle" | "community">("circle");
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    if (!postText.trim() || posting) {
      return;
    }

    setPosting(true);
    try {
      const response = await fetch("/api/circle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: postText.trim(),
          goalId: selectedGoalId || null,
          visibility,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to post");
      }

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

  const displayPosts =
    activeTab === "community"
      ? communityPosts
      : activeTab === "mine"
      ? circlePosts.filter((post) => post.author?.id === currentUserId)
      : circlePosts;

  const emptyMessage =
    activeTab === "community"
      ? "No community posts yet."
      : activeTab === "mine"
      ? "You have not posted any updates yet."
      : "No posts yet. Be the first to share.";

  return (
    <>
      <div className="hidden space-y-4 lg:block">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Members", value: circleStats.members },
            { label: "Posts (7d)", value: circleStats.weeklyPosts },
            { label: "Active streaks", value: circleStats.activeStreaks },
            { label: "Public posts", value: circleStats.publicPosts },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-cream-dark bg-white/70 px-4 py-3"
            >
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                {stat.label}
              </p>
              <p className="mt-1 text-xl font-serif text-ink">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="card p-4">
          <p className="desktop-kicker">
            My Accountability Circle
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <div className="w-[102px] rounded-[1rem] border border-gold/80 bg-gold/10 px-3 py-3 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gold text-sm font-bold text-ink">
                You
              </div>
              <p className="mt-2 text-[0.9rem] font-semibold text-ink">You</p>
            </div>
            {circleMembers.map((member) => (
              <div key={member.id} className="w-[102px] rounded-[1rem] border border-cream-dark bg-cream-paper px-3 py-3 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gold/50 text-sm font-bold text-ink">
                  {member.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.image} alt={member.name ?? ""} className="h-full w-full object-cover" />
                  ) : (
                    initials(member.name)
                  )}
                </div>
                {member.username ? (
                  <Link
                    href={`/profile/${member.username}`}
                    className="mt-2 block truncate text-[0.9rem] font-semibold text-ink hover:underline"
                  >
                    {member.name?.split(" ")[0] ?? `@${member.username}`}
                  </Link>
                ) : (
                  <p className="mt-2 truncate text-[0.9rem] font-semibold text-ink">
                    {member.name?.split(" ")[0]}
                  </p>
                )}
                {member.streak > 0 ? <p className="text-xs text-ink-muted">{member.streak} 🔥 streak</p> : null}
              </div>
            ))}
            {circleMembers.length === 0 ? (
              <p className="flex min-h-[62px] items-center text-sm italic text-ink-muted">
                Invite friends to grow your circle.
              </p>
            ) : null}
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gold text-xs font-bold text-ink">
              Me
            </div>
            <div className="min-w-0 flex-1">
              <textarea
                value={postText}
                onChange={(event) => setPostText(event.target.value)}
                placeholder="Share a win, a struggle, or what you showed up for today..."
                className="h-[62px] w-full resize-none rounded-[0.9rem] border border-cream-dark bg-cream-paper px-4 py-3 text-[0.9rem] text-ink-soft outline-none placeholder:font-medium placeholder:text-ink-muted"
                maxLength={500}
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {userGoals.slice(0, 3).map((goal) => {
                const isSelected = selectedGoalId === goal.id;
                return (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() =>
                      setSelectedGoalId((current) => (current === goal.id ? "" : goal.id))
                    }
                    className={cn(
                      "h-8 rounded-full border px-3 text-[0.8rem] transition-colors",
                      isSelected
                        ? "border-ink bg-ink text-cream-paper"
                        : "border-cream-dark bg-cream-paper text-ink-muted hover:text-ink"
                    )}
                  >
                    {goal.emoji} {goal.title}
                  </button>
                );
              })}
              <span className="text-[0.8rem] text-ink-muted">{postText.length}/500</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVisibility((value) => (value === "circle" ? "community" : "circle"))}
                className="h-8 rounded-full border border-cream-dark bg-cream-paper px-3 text-[0.8rem] text-ink-muted"
              >
                {visibility === "circle" ? "Circle only" : "Community"}
              </button>
              <button
                type="button"
                onClick={() => void handlePost()}
                disabled={!postText.trim() || posting}
                className="btn-primary min-h-[40px] rounded-full px-5 text-[0.88rem] disabled:opacity-40"
              >
                {posting ? "Posting..." : "Post update →"}
              </button>
            </div>
          </div>
        </div>

        <div className="flex border-b border-cream-dark">
          {(["circle", "community", "mine"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "border-b-2 px-5 py-3 text-[0.9rem] font-medium capitalize transition-all -mb-px",
                activeTab === tab
                  ? "border-ink text-ink"
                  : "border-transparent text-ink-muted hover:text-ink"
              )}
            >
              {tab === "mine" ? "My Updates" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {displayPosts.length === 0 ? (
            <div className="py-12 text-center">
              <p className="mb-3 text-4xl">💬</p>
              <p className="text-sm text-ink-muted">{emptyMessage}</p>
            </div>
          ) : (
            displayPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                variant="desktop"
              />
            ))
          )}
        </div>
      </div>

      <div className="space-y-6 lg:hidden">
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Members", value: circleStats.members },
            { label: "Posts (7d)", value: circleStats.weeklyPosts },
            { label: "Streaks", value: circleStats.activeStreaks },
            { label: "Public", value: circleStats.publicPosts },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-[1.25rem] border border-cream-dark bg-white/70 px-3 py-3"
            >
              <p className="text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                {stat.label}
              </p>
              <p className="mt-1 text-lg font-serif text-ink">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="panel-shell p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
            My Accountability Circle
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold text-sm font-bold text-ink">
                You
              </div>
              <span className="text-xs text-ink-muted">You</span>
            </div>
            {circleMembers.map((member) => (
              <div key={member.id} className="flex flex-col items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-gold/50 text-sm font-bold text-ink">
                  {member.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.image} alt={member.name ?? ""} className="h-full w-full object-cover" />
                  ) : (
                    initials(member.name)
                  )}
                </div>
                {member.username ? (
                  <Link
                    href={`/profile/${member.username}`}
                    className="max-w-[64px] truncate text-xs text-ink-muted hover:underline"
                  >
                    {member.name?.split(" ")[0] ?? `@${member.username}`}
                  </Link>
                ) : (
                  <span className="max-w-[64px] truncate text-xs text-ink-muted">
                    {member.name?.split(" ")[0]}
                  </span>
                )}
                {member.streak > 0 ? <span className="text-xs text-gold">🔥{member.streak}</span> : null}
              </div>
            ))}
            {circleMembers.length === 0 ? (
              <p className="flex min-h-[48px] items-center text-sm italic text-ink-muted">
                Invite friends to grow your circle.
              </p>
            ) : null}
          </div>
        </div>

        <div className="panel-shell p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gold text-xs font-bold text-ink">
              Me
            </div>
            <select
              value={selectedGoalId}
              onChange={(event) => setSelectedGoalId(event.target.value)}
              className="min-h-[48px] rounded-2xl border border-cream-dark bg-white/80 px-4 text-sm text-ink outline-none"
            >
              <option value="">No goal</option>
              {userGoals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.emoji} {goal.title}
                </option>
              ))}
            </select>
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as "circle" | "community")}
              className="min-h-[48px] rounded-2xl border border-cream-dark bg-white/80 px-4 text-sm text-ink outline-none sm:ml-auto"
            >
              <option value="circle">Circle only</option>
              <option value="community">Community</option>
            </select>
          </div>

          <textarea
            value={postText}
            onChange={(event) => setPostText(event.target.value)}
            placeholder="Share a check-in with your circle..."
            className="mt-4 h-28 w-full resize-none rounded-[1.5rem] border border-cream-dark bg-white/80 p-4 text-sm text-ink outline-none placeholder:text-ink-muted"
            maxLength={500}
          />

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-ink-muted">{postText.length}/500</span>
            <button
              type="button"
              onClick={() => void handlePost()}
              disabled={!postText.trim() || posting}
              className="btn-primary min-h-[48px] rounded-2xl px-5 disabled:opacity-40"
            >
              {posting ? "Posting..." : "Post update"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-[1.5rem] border border-cream-dark bg-white/70 p-2">
          {(["circle", "community", "mine"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "min-h-[46px] rounded-2xl px-3 text-sm font-medium capitalize transition-all",
                activeTab === tab
                  ? "bg-ink text-cream-paper"
                  : "text-ink-muted hover:bg-white hover:text-ink"
              )}
            >
              {tab === "mine" ? "My Updates" : tab}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {displayPosts.length === 0 ? (
            <div className="panel-shell px-6 py-10 text-center">
              <p className="text-4xl">💬</p>
              <p className="mt-3 text-sm text-ink-muted">{emptyMessage}</p>
            </div>
          ) : (
            displayPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                variant="mobile"
              />
            ))
          )}
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-[#2A2522] bg-[#171411] p-5 shadow-[0_30px_90px_rgba(26,23,20,0.2)] sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#C7AF7A]">
            North Star App
          </p>
          <h3 className="mt-3 text-2xl font-serif text-white">Top 10 Leaderboard</h3>
          <p className="mt-2 text-sm text-white/35">Ranked by momentum score</p>
          <div className="mt-5 space-y-2">
            {leaderboard.map((user, index) => {
              const isYou = user.id === currentUserId;
              return (
                <div
                  key={user.id}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-3 transition-all",
                    isYou && "ring-1 ring-gold/30"
                  )}
                  style={isYou ? { background: "rgba(196,150,58,0.09)" } : undefined}
                >
                  <span className="w-5 text-center text-xs font-bold text-white/35">
                    {index + 1}
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-2xl bg-gold text-xs font-bold text-ink">
                    {user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.image} alt={user.name ?? ""} className="h-full w-full object-cover" />
                    ) : (
                      initials(user.name)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {isYou ? (
                      <div className="truncate text-sm font-medium text-white/90">You</div>
                    ) : user.username ? (
                      <Link
                        href={`/profile/${user.username}`}
                        className="truncate text-sm font-medium text-white/90 hover:underline"
                      >
                        {user.name ?? `@${user.username}`}
                      </Link>
                    ) : (
                      <div className="truncate text-sm font-medium text-white/90">
                        {user.name}
                      </div>
                    )}
                    {user.streak > 0 ? (
                      <div className="text-xs text-white/35">🔥 {user.streak} streak</div>
                    ) : null}
                  </div>
                  <span className="text-sm font-mono font-bold text-[#E8C97A]">
                    {user.score}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function PostCard({
  post,
  currentUserId,
  variant,
}: {
  post: PostData;
  currentUserId: string;
  variant: "desktop" | "mobile";
}) {
  const [reactions, setReactions] = useState<Record<string, number>>(post.reactionCounts ?? {});
  const [reacting, setReacting] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyCount, setReplyCount] = useState(post.replyCount);
  const [replying, setReplying] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  const handleReact = async (emoji: (typeof REACTIONS)[number]) => {
    if (reacting) {
      return;
    }

    const previous = reactions;
    setReacting(true);
    setReactions((current) => ({
      ...current,
      [emoji]: (current[emoji] ?? 0) + 1,
    }));

    try {
      const response = await fetch(`/api/circle/${post.id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });

      if (!response.ok) {
        throw new Error("Failed to react");
      }

      const json = (await response.json()) as { counts?: Record<string, number> };
      if (json.counts) {
        setReactions(json.counts);
      }
    } catch {
      setReactions(previous);
    } finally {
      setReacting(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || replying) {
      return;
    }

    setReplying(true);
    try {
      const response = await fetch(`/api/circle/${post.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: replyText.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to reply");
      }

      toast("Reply added ✓");
      setReplyText("");
      setReplyOpen(false);
      setReplyCount((count) => count + 1);
    } catch {
      toast("Failed to reply", "error");
    } finally {
      setReplying(false);
    }
  };

  const containerClassName =
    variant === "desktop" ? "card p-4" : "panel-shell p-5 sm:p-6";
  const avatarClassName =
    variant === "desktop"
      ? "flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gold text-xs font-bold text-ink"
      : "flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-gold text-xs font-bold text-ink";
  const quoteClassName =
    variant === "desktop"
      ? "mb-3 text-[0.9rem] leading-[1.5] text-ink-soft"
      : "mt-3 text-sm italic leading-6 text-ink-soft";
  const replyBoxClassName =
    variant === "desktop"
      ? "mt-4 space-y-3 rounded-xl border border-cream-dark bg-cream p-4"
      : "mt-4 space-y-3 rounded-[1.5rem] border border-cream-dark bg-white/75 p-4";

  return (
    <article className={containerClassName}>
      <div className={variant === "desktop" ? "mb-3 flex gap-3" : "flex gap-3"}>
        <div className={avatarClassName}>
          {post.author?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.author.image} alt={post.author.name ?? ""} className="h-full w-full object-cover" />
          ) : (
            initials(post.author?.name)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.9rem] font-semibold text-ink">
              {post.author?.id === currentUserId ? (
                "You"
              ) : post.author?.username ? (
                <Link href={`/profile/${post.author.username}`} className="hover:underline">
                  {post.author.name ?? `@${post.author.username}`}
                </Link>
              ) : (
                post.author?.name
              )}
            </span>
            {post.goalTitle ? (
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-[0.8rem]",
                  variant === "desktop"
                    ? "border-cream-dark bg-cream text-ink-muted"
                    : "border-cream-dark bg-cream-paper text-ink-muted"
                )}
              >
                {post.goalTitle}
              </span>
            ) : null}
            <span className="text-[0.76rem] text-ink-muted">{relativeTime(post.createdAt)}</span>
          </div>
          <p className={quoteClassName}>&ldquo;{post.text}&rdquo;</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => void handleReact(emoji)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-cream-dark px-3 py-1.5 text-[0.8rem] transition-colors",
              variant === "desktop"
                ? "hover:border-ink-muted hover:bg-cream"
                : "bg-cream-paper text-ink-muted hover:border-ink-muted hover:text-ink"
            )}
          >
            <span>{emoji}</span>
            {(reactions[emoji] ?? 0) > 0 ? <span>{reactions[emoji]}</span> : null}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setReplyOpen((current) => !current)}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[0.8rem] font-medium text-ink-muted transition-colors hover:bg-cream hover:text-ink"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          <span>Reply</span>
          {replyCount > 0 ? <span>({replyCount})</span> : null}
        </button>
        <button
          type="button"
          onClick={() => setCommentOpen((c) => !c)}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[0.82rem] font-medium text-ink-muted transition-colors hover:bg-cream hover:text-ink"
        >
          <span>💬</span>
          {commentCount > 0 ? <span>{commentCount}</span> : null}
        </button>
      </div>

      {replyOpen ? (
        <div className={replyBoxClassName}>
          <textarea
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            placeholder="Write a reply..."
            className="h-24 w-full resize-none rounded-[1.25rem] border border-cream-dark bg-white p-3 text-sm text-ink outline-none placeholder:text-ink-muted"
            maxLength={240}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-ink-muted">{replyText.length}/240</span>
            <div className="flex gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => setReplyOpen(false)}
                className="btn-secondary min-h-[42px] rounded-2xl px-4 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleReply()}
                disabled={!replyText.trim() || replying}
                className="btn-primary min-h-[42px] rounded-2xl px-4 text-xs disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
                {replying ? "Sending..." : "Reply"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {commentOpen ? (
        <div className="mt-3 border-t border-cream-dark pt-3">
          <CommentsList
            postId={post.id}
            currentUserId={currentUserId}
            onCountChange={setCommentCount}
          />
        </div>
      ) : null}
    </article>
  );
}
