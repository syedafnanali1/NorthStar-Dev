"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageCircle, Send, Search, UserPlus, Bell, Users, ArrowUpRight } from "lucide-react";
import { cn, initials, relativeTime } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";
import { CommentsList } from "@/components/circle/comments-list";
import { InviteCircleButton } from "@/components/circle/invite-circle-button";
import { UserSearchModal } from "@/components/circle/user-search-modal";
import { UserProfileModal } from "@/components/circle/user-profile-modal";
import { DmModal } from "@/components/circle/dm-modal";
import { PendingRequestsPanel } from "@/components/circle/pending-requests-panel";
import { FriendCelebration } from "@/components/circle/friend-celebration";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PostData {
  id: string;
  text: string;
  goalId: string | null;
  visibility: string;
  reactionCounts: Record<string, number>;
  replyCount: number;
  createdAt: Date;
  author: { id: string | null; name: string | null; username: string | null; image: string | null; streak: number } | null;
  goalTitle: string | null;
}

interface CircleMember {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  streak: number;
  momentumScore: number;
  jobTitle: string | null;
  location: string | null;
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

interface PendingRequest {
  connectionId: string;
  direction: "incoming" | "outgoing";
  createdAt: Date;
  user: { id: string; name: string | null; username: string | null; image: string | null };
}

interface CircleFeedProps {
  currentUserId: string;
  currentUserName: string;
  circleMembers: CircleMember[];
  userGoals: { id: string; title: string; emoji: string | null }[];
  circlePosts: PostData[];
  communityPosts: PostData[];
  leaderboard: LeaderboardUser[];
  circleStats: CircleStats;
  pendingRequests: PendingRequest[];
}

const REACTIONS = ["🔥", "💪", "💙", "✨"] as const;

// ─── Main Component ───────────────────────────────────────────────────────────

export function CircleFeed({
  currentUserId,
  currentUserName,
  circleMembers,
  userGoals,
  circlePosts,
  communityPosts,
  leaderboard,
  circleStats,
  pendingRequests,
}: CircleFeedProps) {
  const router = useRouter();

  // UI state
  const [activeTab, setActiveTab] = useState<"circle" | "community" | "mine">("circle");
  const [postText, setPostText] = useState("");
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [visibility, setVisibility] = useState<"circle" | "community">("circle");
  const [posting, setPosting] = useState(false);

  // Modal state
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dmUserId, setDmUserId] = useState<string | null>(null);
  const [dmUserName, setDmUserName] = useState("");
  const [dmOpen, setDmOpen] = useState(false);

  // Celebration state
  const [celebOpen, setCelebOpen] = useState(false);
  const [celebName, setCelebName] = useState("");

  const incomingCount = pendingRequests.filter((r) => r.direction === "incoming").length;

  // Connection celebration callback
  const handleConnected = useCallback((name: string) => {
    setCelebName(name);
    setCelebOpen(true);
    router.refresh();
  }, [router]);

  // Open profile modal
  const openProfile = useCallback((userId: string) => {
    setProfileUserId(userId);
    setProfileOpen(true);
  }, []);

  // Open DM
  const openDm = useCallback((userId: string, userName: string) => {
    setDmUserId(userId);
    setDmUserName(userName);
    setDmOpen(true);
  }, []);

  // Post
  const handlePost = async () => {
    if (!postText.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch("/api/circle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: postText.trim(), goalId: selectedGoalId || null, visibility }),
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

  const displayPosts =
    activeTab === "community" ? communityPosts
    : activeTab === "mine" ? circlePosts.filter((p) => p.author?.id === currentUserId)
    : circlePosts;

  const emptyMessage =
    activeTab === "community" ? "No community posts yet."
    : activeTab === "mine" ? "You haven't posted yet."
    : "No posts yet. Be the first to share.";

  return (
    <>
      {/* ── Modals ─────────────────────────────────────────── */}
      <UserSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onConnected={handleConnected}
        onViewProfile={(userId) => {
          setSearchOpen(false);
          openProfile(userId);
        }}
      />

      <UserProfileModal
        userId={profileUserId}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onMessage={(userId, name) => openDm(userId, name)}
        onConnected={handleConnected}
      />

      <DmModal
        targetUserId={dmUserId}
        targetUserName={dmUserName}
        currentUserId={currentUserId}
        open={dmOpen}
        onClose={() => setDmOpen(false)}
      />

      <FriendCelebration
        isOpen={celebOpen}
        onClose={() => setCelebOpen(false)}
        friendName={celebName}
      />

      {/* ── Desktop layout ─────────────────────────────────── */}
      <div className="hidden space-y-5 lg:block">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Circle members", value: circleStats.members },
            { label: "Posts this week", value: circleStats.weeklyPosts },
            { label: "Active streaks", value: circleStats.activeStreaks },
            { label: "Public posts", value: circleStats.publicPosts },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-cream-dark bg-white/70 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">{s.label}</p>
              <p className="mt-1 font-serif text-xl text-ink">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-full border border-cream-dark bg-white/70 px-4 py-2 text-sm font-medium text-ink transition hover:bg-cream hover:shadow-sm"
          >
            <Search className="h-3.5 w-3.5" />
            Find People
          </button>
          {incomingCount > 0 && (
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold"
              onClick={() => {/* scroll to requests */}}
            >
              <Bell className="h-3.5 w-3.5" />
              {incomingCount} Request{incomingCount > 1 ? "s" : ""}
            </button>
          )}
          <div className="ml-auto">
            <InviteCircleButton />
          </div>
        </div>

        {/* Pending requests */}
        <PendingRequestsPanel requests={pendingRequests} onAccepted={handleConnected} />

        {/* Circle members grid */}
        <div className="card p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="desktop-kicker">My Accountability Circle</p>
            <span className="text-xs text-ink-muted">{circleStats.members} member{circleStats.members !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {/* Self card */}
            <div className="w-[102px] rounded-[1rem] border border-gold/80 bg-gold/10 px-3 py-3 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gold text-sm font-bold text-ink">
                {initials(currentUserName)}
              </div>
              <p className="mt-2 truncate text-[0.9rem] font-semibold text-ink">You</p>
            </div>
            {circleMembers.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => openProfile(member.id)}
                className="w-[102px] rounded-[1rem] border border-cream-dark bg-cream-paper px-3 py-3 text-center transition hover:border-ink-muted hover:shadow-sm active:scale-95"
              >
                <div className="mx-auto flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gold/50 text-sm font-bold text-ink">
                  {member.image
                    ? <img src={member.image} alt={member.name ?? ""} className="h-full w-full object-cover" />
                    : initials(member.name)
                  }
                </div>
                <p className="mt-2 truncate text-[0.9rem] font-semibold text-ink">
                  {member.name?.split(" ")[0] ?? `@${member.username}`}
                </p>
                {member.streak > 0
                  ? <p className="text-xs text-ink-muted">{member.streak} 🔥</p>
                  : <p className="text-xs text-ink-muted/40">—</p>
                }
              </button>
            ))}
            {circleMembers.length === 0 && (
              <p className="flex min-h-[62px] items-center text-sm italic text-ink-muted">
                Invite friends to grow your circle.
              </p>
            )}
          </div>
        </div>

        {/* Post composer */}
        <div className="card p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gold text-xs font-bold text-ink">
              {initials(currentUserName)}
            </div>
            <div className="min-w-0 flex-1">
              <textarea
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="Share a win, a struggle, or what you showed up for today…"
                className="h-[62px] w-full resize-none rounded-[0.9rem] border border-cream-dark bg-cream-paper px-4 py-3 text-[0.9rem] text-ink-soft outline-none placeholder:font-medium placeholder:text-ink-muted"
                maxLength={500}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {userGoals.slice(0, 3).map((goal) => (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => setSelectedGoalId((c) => c === goal.id ? "" : goal.id)}
                  className={cn(
                    "h-8 rounded-full border px-3 text-[0.8rem] transition-colors",
                    selectedGoalId === goal.id
                      ? "border-ink bg-ink text-cream-paper"
                      : "border-cream-dark bg-cream-paper text-ink-muted hover:text-ink"
                  )}
                >
                  {goal.emoji} {goal.title}
                </button>
              ))}
              <span className="text-[0.8rem] text-ink-muted">{postText.length}/500</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVisibility((v) => v === "circle" ? "community" : "circle")}
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
                {posting ? "Posting…" : "Post update →"}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-cream-dark">
          {(["circle", "community", "mine"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "-mb-px border-b-2 px-5 py-3 text-[0.9rem] font-medium capitalize transition-all",
                activeTab === tab ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink"
              )}
            >
              {tab === "mine" ? "My Updates" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Posts */}
        <div className="space-y-4">
          {displayPosts.length === 0 ? (
            <div className="py-12 text-center">
              <p className="mb-3 text-4xl">💬</p>
              <p className="text-sm text-ink-muted">{emptyMessage}</p>
            </div>
          ) : (
            displayPosts.map((post) => (
              <PostCard key={post.id} post={post} currentUserId={currentUserId} onViewProfile={openProfile} />
            ))
          )}
        </div>
      </div>

      {/* ── Mobile layout ──────────────────────────────────── */}
      <div className="space-y-5 lg:hidden">
        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex flex-1 items-center gap-2 rounded-2xl border border-cream-dark bg-white/70 px-4 py-3 text-sm font-medium text-ink transition active:scale-95"
          >
            <Search className="h-4 w-4 text-ink-muted" />
            Find People
          </button>
          {incomingCount > 0 ? (
            <div className="flex items-center gap-1.5 rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm font-semibold text-gold">
              <Bell className="h-4 w-4" />
              {incomingCount}
            </div>
          ) : null}
          <InviteCircleButton />
        </div>

        {/* Stats mini grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Members", value: circleStats.members },
            { label: "Streaks", value: circleStats.activeStreaks },
          ].map((s) => (
            <div key={s.label} className="rounded-[1.25rem] border border-cream-dark bg-white/70 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-ink-muted">{s.label}</p>
              <p className="mt-1 font-serif text-lg text-ink">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Pending requests */}
        <PendingRequestsPanel requests={pendingRequests} onAccepted={handleConnected} />

        {/* Circle members horizontal scroll */}
        <div className="panel-shell p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
            My Circle · {circleStats.members}
          </p>
          <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* Self */}
            <div className="flex flex-shrink-0 flex-col items-center gap-1.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold text-sm font-bold text-ink">
                {initials(currentUserName)}
              </div>
              <span className="max-w-[52px] truncate text-[10px] font-medium text-ink-muted">You</span>
            </div>
            {circleMembers.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => openProfile(member.id)}
                className="flex flex-shrink-0 flex-col items-center gap-1.5 active:scale-95"
              >
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-gold/50 text-sm font-bold text-ink">
                  {member.image
                    ? <img src={member.image} alt={member.name ?? ""} className="h-full w-full object-cover" />
                    : initials(member.name)
                  }
                </div>
                <span className="max-w-[52px] truncate text-[10px] font-medium text-ink-muted">
                  {member.name?.split(" ")[0] ?? `@${member.username}`}
                </span>
                {member.streak > 0
                  ? <span className="text-[10px] text-gold">🔥{member.streak}</span>
                  : null
                }
              </button>
            ))}
            {circleMembers.length === 0 && (
              <p className="flex min-h-[48px] items-center text-sm italic text-ink-muted">
                Add friends to see them here.
              </p>
            )}
          </div>
        </div>

        {/* Post composer */}
        <div className="panel-shell p-4">
          <div className="flex items-center gap-2 mb-3">
            <select
              value={selectedGoalId}
              onChange={(e) => setSelectedGoalId(e.target.value)}
              className="min-h-[44px] flex-1 rounded-2xl border border-cream-dark bg-white/80 px-3 text-sm text-ink outline-none"
            >
              <option value="">No goal</option>
              {userGoals.map((g) => (
                <option key={g.id} value={g.id}>{g.emoji} {g.title}</option>
              ))}
            </select>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "circle" | "community")}
              className="min-h-[44px] rounded-2xl border border-cream-dark bg-white/80 px-3 text-sm text-ink outline-none"
            >
              <option value="circle">Circle</option>
              <option value="community">Public</option>
            </select>
          </div>
          <textarea
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            placeholder="Share a check-in with your circle…"
            className="h-24 w-full resize-none rounded-2xl border border-cream-dark bg-white/80 p-3.5 text-sm text-ink outline-none placeholder:text-ink-muted"
            maxLength={500}
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-ink-muted">{postText.length}/500</span>
            <button
              type="button"
              onClick={() => void handlePost()}
              disabled={!postText.trim() || posting}
              className="btn-primary min-h-[44px] rounded-2xl px-5 disabled:opacity-40"
            >
              {posting ? "Posting…" : "Post update"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-cream-dark bg-white/70 p-1.5">
          {(["circle", "community", "mine"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "min-h-[44px] rounded-xl px-2 text-sm font-medium capitalize transition-all",
                activeTab === tab ? "bg-ink text-cream-paper shadow-sm" : "text-ink-muted hover:text-ink"
              )}
            >
              {tab === "mine" ? "Mine" : tab}
            </button>
          ))}
        </div>

        {/* Posts */}
        <div className="space-y-4">
          {displayPosts.length === 0 ? (
            <div className="panel-shell px-6 py-10 text-center">
              <p className="text-4xl">💬</p>
              <p className="mt-3 text-sm text-ink-muted">{emptyMessage}</p>
            </div>
          ) : (
            displayPosts.map((post) => (
              <PostCard key={post.id} post={post} currentUserId={currentUserId} onViewProfile={openProfile} />
            ))
          )}
        </div>

        {/* Leaderboard (mobile) */}
        <Leaderboard leaderboard={leaderboard} currentUserId={currentUserId} />
      </div>
    </>
  );
}

// ─── Leaderboard Component ────────────────────────────────────────────────────

function Leaderboard({ leaderboard, currentUserId }: { leaderboard: LeaderboardUser[]; currentUserId: string }) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-[#2A2522] bg-[#171411] p-5 shadow-[0_30px_90px_rgba(26,23,20,0.2)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#C7AF7A]">North Star App</p>
          <h3 className="mt-2 font-serif text-xl text-white">Top 10 Leaderboard</h3>
          <p className="mt-1 text-xs text-white/35">Momentum · Streak · Goals</p>
        </div>
        <Link href="/analytics" className="flex items-center gap-1 text-xs text-white/35 hover:text-white">
          Analytics <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="mt-4 space-y-1.5">
        {leaderboard.map((user, idx) => {
          const isYou = user.id === currentUserId;
          const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
          return (
            <div
              key={user.id}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all",
                isYou && "ring-1 ring-gold/30"
              )}
              style={isYou ? { background: "rgba(196,150,58,0.09)" } : undefined}
            >
              <span className="w-6 text-center text-xs font-bold text-white/30">
                {medal ?? `${idx + 1}`}
              </span>
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-2xl bg-gold text-xs font-bold text-ink">
                {user.image
                  ? <img src={user.image} alt={user.name ?? ""} className="h-full w-full object-cover" />
                  : initials(user.name)
                }
              </div>
              <div className="min-w-0 flex-1">
                {isYou ? (
                  <p className="truncate text-sm font-semibold text-white/90">You</p>
                ) : user.username ? (
                  <Link href={`/profile/${user.username}`} className="truncate text-sm font-semibold text-white/90 hover:underline">
                    {user.name ?? `@${user.username}`}
                  </Link>
                ) : (
                  <p className="truncate text-sm font-semibold text-white/90">{user.name ?? "—"}</p>
                )}
                {user.streak > 0 && (
                  <p className="text-xs text-white/30">🔥 {user.streak}-day streak</p>
                )}
              </div>
              <span className="font-mono text-sm font-bold text-[#E8C97A]">{user.score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({
  post,
  currentUserId,
  onViewProfile,
}: {
  post: PostData;
  currentUserId: string;
  onViewProfile: (userId: string) => void;
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
    if (reacting) return;
    const prev = reactions;
    setReacting(true);
    setReactions((r) => ({ ...r, [emoji]: (r[emoji] ?? 0) + 1 }));
    try {
      const res = await fetch(`/api/circle/${post.id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { counts?: Record<string, number> };
      if (json.counts) setReactions(json.counts);
    } catch {
      setReactions(prev);
    } finally {
      setReacting(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || replying) return;
    setReplying(true);
    try {
      const res = await fetch(`/api/circle/${post.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: replyText.trim() }),
      });
      if (!res.ok) throw new Error();
      toast("Reply added ✓");
      setReplyText("");
      setReplyOpen(false);
      setReplyCount((c) => c + 1);
    } catch {
      toast("Failed to reply", "error");
    } finally {
      setReplying(false);
    }
  };

  const isOwnPost = post.author?.id === currentUserId;

  return (
    <article className="panel-shell p-4 sm:p-5">
      <div className="flex gap-3">
        {/* Avatar — clickable if not own post */}
        {isOwnPost ? (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gold text-xs font-bold text-ink">
            {post.author?.image
              ? <img src={post.author.image} alt="" className="h-full w-full object-cover" />
              : initials(post.author?.name)
            }
          </div>
        ) : (
          <button
            type="button"
            onClick={() => post.author?.id && onViewProfile(post.author.id)}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gold/50 text-xs font-bold text-ink transition active:scale-90"
          >
            {post.author?.image
              ? <img src={post.author.image} alt="" className="h-full w-full object-cover" />
              : initials(post.author?.name)
            }
          </button>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">
              {isOwnPost ? "You" : post.author?.username ? (
                <button
                  type="button"
                  onClick={() => post.author?.id && onViewProfile(post.author.id)}
                  className="hover:underline"
                >
                  {post.author.name ?? `@${post.author.username}`}
                </button>
              ) : post.author?.name}
            </span>
            {post.goalTitle && (
              <span className="rounded-full border border-cream-dark bg-cream px-2.5 py-0.5 text-xs text-ink-muted">
                {post.goalTitle}
              </span>
            )}
            <span className="text-xs text-ink-muted">{relativeTime(post.createdAt)}</span>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-ink-soft">&ldquo;{post.text}&rdquo;</p>
        </div>
      </div>

      {/* Reactions + actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => void handleReact(emoji)}
            className="inline-flex items-center gap-1 rounded-full border border-cream-dark bg-cream-paper px-3 py-1.5 text-sm transition hover:border-ink-muted active:scale-95"
          >
            <span>{emoji}</span>
            {(reactions[emoji] ?? 0) > 0 && <span className="text-xs text-ink-muted">{reactions[emoji]}</span>}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setReplyOpen((o) => !o)}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-cream hover:text-ink"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          <span>Reply</span>
          {replyCount > 0 && <span>({replyCount})</span>}
        </button>
        <button
          type="button"
          onClick={() => setCommentOpen((c) => !c)}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-cream hover:text-ink"
        >
          <span>💬</span>
          {commentCount > 0 && <span>{commentCount}</span>}
        </button>
      </div>

      {replyOpen && (
        <div className="mt-4 space-y-3 rounded-2xl border border-cream-dark bg-white/70 p-4">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply…"
            className="h-20 w-full resize-none rounded-xl border border-cream-dark bg-white p-3 text-sm text-ink outline-none placeholder:text-ink-muted"
            maxLength={240}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-ink-muted">{replyText.length}/240</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReplyOpen(false)}
                className="btn-secondary min-h-[40px] rounded-2xl px-4 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleReply()}
                disabled={!replyText.trim() || replying}
                className="btn-primary min-h-[40px] rounded-2xl px-4 text-xs disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
                {replying ? "Sending…" : "Reply"}
              </button>
            </div>
          </div>
        </div>
      )}

      {commentOpen && (
        <div className="mt-3 border-t border-cream-dark pt-3">
          <CommentsList postId={post.id} currentUserId={currentUserId} onCountChange={setCommentCount} />
        </div>
      )}
    </article>
  );
}
