"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, MessageCircle, UserPlus, Check, MapPin, Briefcase, Target, Users, Clock, Star } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";

interface ProfileGoal {
  id: string;
  title: string;
  emoji: string | null;
  color: string | null;
  currentValue: number;
  targetValue: number | null;
}

interface ProfileGroup {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
}

interface FullProfile {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  age: number | null;
  location: string | null;
  jobTitle: string | null;
  countryRegion: string | null;
  isConnected: boolean;
  connectionStatus: { id: string; status: string; direction: "sent" | "received" } | null;
  // Connected-only fields:
  momentumScore?: number;
  currentStreak?: number;
  totalGoalsCompleted?: number;
  northStarScore?: number;
  circleCount?: number;
  activeGoals?: ProfileGoal[];
  groups?: ProfileGroup[];
}

interface UserProfileModalProps {
  userId: string | null;
  open: boolean;
  onClose: () => void;
  onMessage: (userId: string, userName: string) => void;
  onConnected: (userName: string) => void;
}

export function UserProfileModal({ userId, open, onClose, onMessage, onConnected }: UserProfileModalProps) {
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !userId) { setProfile(null); return; }
    setLoading(true);
    fetch(`/api/users/${userId}/profile`)
      .then((r) => r.json())
      .then((data: { profile?: FullProfile }) => { setProfile(data.profile ?? null); })
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false));
  }, [open, userId]);

  const handleConnect = async () => {
    if (!profile || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: profile.username ?? undefined }),
      });
      const data = (await res.json()) as { status?: string; error?: string };
      if (!res.ok) {
        toast(data.error ?? "Failed to send request", "error");
        return;
      }
      if (data.status === "accepted" || data.status === "already_friends") {
        toast("Connected ✓");
        onConnected(profile.name ?? profile.username ?? "them");
        setProfile((p) => p ? { ...p, isConnected: true, connectionStatus: { id: "", status: "accepted", direction: "sent" } } : p);
      } else {
        toast("Request sent ✓");
        setProfile((p) => p ? { ...p, connectionStatus: { id: "", status: "pending", direction: "sent" } } : p);
      }
    } catch {
      toast("Failed to send request", "error");
    } finally {
      setSending(false);
    }
  };

  const conn = profile?.connectionStatus;
  const isAccepted = conn?.status === "accepted";
  const isPendingSent = conn?.status === "pending" && conn.direction === "sent";
  const isPendingReceived = conn?.status === "pending" && conn.direction === "received";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[85] flex items-end bg-[rgba(26,23,20,0.58)] backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ y: 28, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="mobile-sheet w-full bg-cream-paper sm:max-w-sm sm:rounded-3xl"
          >
            {/* Close */}
            <div className="flex justify-end px-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-cream-dark text-ink-muted hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div
              className="overflow-y-auto overscroll-contain px-5 pb-6"
              style={{ maxHeight: "min(600px, calc(100dvh - 100px))" }}
            >
              {loading && (
                <div className="py-16 text-center text-sm text-ink-muted">Loading profile…</div>
              )}

              {!loading && !profile && (
                <div className="py-16 text-center text-sm text-ink-muted">Profile not found.</div>
              )}

              {!loading && profile && (
                <>
                  {/* Avatar + name */}
                  <div className="flex flex-col items-center pb-5 pt-2 text-center">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-gold text-xl font-bold text-ink shadow-lg">
                      {profile.image
                        ? <img src={profile.image} alt={profile.name ?? ""} className="h-full w-full object-cover" />
                        : initials(profile.name)
                      }
                    </div>
                    <h2 className="mt-3 font-serif text-xl font-semibold text-ink">
                      {profile.name ?? `@${profile.username}`}
                    </h2>
                    {profile.username && (
                      <p className="text-sm text-ink-muted">@{profile.username}</p>
                    )}

                    {/* Basic metadata pills */}
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      {profile.jobTitle && (
                        <span className="flex items-center gap-1.5 rounded-xl border border-cream-dark bg-cream px-3 py-1 text-xs text-ink-soft">
                          <Briefcase className="h-3 w-3" />
                          {profile.jobTitle}
                        </span>
                      )}
                      {profile.location && (
                        <span className="flex items-center gap-1.5 rounded-xl border border-cream-dark bg-cream px-3 py-1 text-xs text-ink-soft">
                          <MapPin className="h-3 w-3" />
                          {profile.location}
                        </span>
                      )}
                      {profile.countryRegion && !profile.location && (
                        <span className="flex items-center gap-1.5 rounded-xl border border-cream-dark bg-cream px-3 py-1 text-xs text-ink-soft">
                          <MapPin className="h-3 w-3" />
                          {profile.countryRegion}
                        </span>
                      )}
                      {profile.age && (
                        <span className="rounded-xl border border-cream-dark bg-cream px-3 py-1 text-xs text-ink-soft">
                          {profile.age} yrs
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="mt-4 flex gap-2">
                      {isAccepted ? (
                        <button
                          type="button"
                          onClick={() => { onMessage(profile.id, profile.name ?? profile.username ?? "User"); onClose(); }}
                          className="flex items-center gap-2 rounded-2xl border border-ink bg-ink px-5 py-2.5 text-sm font-semibold text-cream-paper transition hover:opacity-80"
                        >
                          <MessageCircle className="h-4 w-4" />
                          Message
                        </button>
                      ) : isPendingSent ? (
                        <span className="flex items-center gap-2 rounded-2xl border border-cream-dark bg-cream px-5 py-2.5 text-sm font-semibold text-ink-muted">
                          <Clock className="h-4 w-4" />
                          Pending
                        </span>
                      ) : isPendingReceived ? (
                        <button
                          type="button"
                          onClick={handleConnect}
                          disabled={sending}
                          className="flex items-center gap-2 rounded-2xl border border-gold/40 bg-gold/10 px-5 py-2.5 text-sm font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" />
                          {sending ? "Accepting…" : "Accept Request"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleConnect}
                          disabled={sending}
                          className="flex items-center gap-2 rounded-2xl border border-ink bg-ink px-5 py-2.5 text-sm font-semibold text-cream-paper transition hover:opacity-80 disabled:opacity-50"
                        >
                          <UserPlus className="h-4 w-4" />
                          {sending ? "Sending…" : "Add to Circle"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Connected: show full details */}
                  {isAccepted && (
                    <div className="space-y-4">
                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Momentum", value: profile.momentumScore ?? 0, suffix: "/100" },
                          { label: "Streak", value: profile.currentStreak ?? 0, suffix: "d 🔥" },
                          { label: "Goals Done", value: profile.totalGoalsCompleted ?? 0, suffix: "" },
                        ].map((s) => (
                          <div key={s.label} className="rounded-2xl border border-cream-dark bg-white/60 px-3 py-3 text-center">
                            <p className="font-serif text-lg font-semibold text-ink">{s.value}{s.suffix}</p>
                            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{s.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Circle count + App score */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 rounded-2xl border border-cream-dark bg-white/60 px-3 py-2.5">
                          <Users className="h-4 w-4 flex-shrink-0 text-ink-muted" />
                          <div>
                            <p className="text-sm font-semibold text-ink">{profile.circleCount ?? 0} people</p>
                            <p className="text-[10px] text-ink-muted">In their circle</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-2xl border border-cream-dark bg-white/60 px-3 py-2.5">
                          <Star className="h-4 w-4 flex-shrink-0 text-gold" />
                          <div>
                            <p className="text-sm font-semibold text-ink">{profile.northStarScore ?? 0} pts</p>
                            <p className="text-[10px] text-ink-muted">App score</p>
                          </div>
                        </div>
                      </div>

                      {/* Active goals */}
                      {(profile.activeGoals?.length ?? 0) > 0 && (
                        <div>
                          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                            <Target className="h-3 w-3" /> Active Goals
                          </p>
                          <div className="space-y-2">
                            {profile.activeGoals!.map((goal) => {
                              const pct = goal.targetValue && goal.targetValue > 0
                                ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))
                                : 0;
                              return (
                                <div key={goal.id} className="rounded-2xl border border-cream-dark bg-white/60 px-3 py-2.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="truncate text-sm font-semibold text-ink">{goal.emoji} {goal.title}</p>
                                    <span className="font-mono text-xs text-ink-muted">{pct}%</span>
                                  </div>
                                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-cream-dark">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: goal.color ?? "#C4963A" }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Groups */}
                      {(profile.groups?.length ?? 0) > 0 && (
                        <div>
                          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                            <Users className="h-3 w-3" /> Groups
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {profile.groups!.map((g) => (
                              <span
                                key={g.id}
                                className="flex items-center gap-1.5 rounded-xl border border-cream-dark bg-cream px-3 py-1.5 text-xs font-medium text-ink"
                              >
                                <span>{g.icon ?? "⭐"}</span>
                                {g.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Not connected: locked message */}
                  {!isAccepted && !isPendingSent && !isPendingReceived && (
                    <div className="rounded-2xl border border-dashed border-cream-dark px-4 py-5 text-center">
                      <p className="text-2xl">🔒</p>
                      <p className="mt-1.5 text-sm text-ink-muted">Connect to see goals, groups, and scores.</p>
                    </div>
                  )}

                  {/* Pending: partial lock message */}
                  {isPendingSent && (
                    <div className="rounded-2xl border border-dashed border-cream-dark px-4 py-5 text-center">
                      <p className="text-2xl">⏳</p>
                      <p className="mt-1.5 text-sm text-ink-muted">Waiting for them to accept your request.</p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="h-[env(safe-area-inset-bottom,0px)]" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
