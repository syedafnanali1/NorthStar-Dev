"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X, UserPlus, Check, Clock, ChevronRight } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";

interface SearchUser {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  age: number | null;
  location: string | null;
  jobTitle: string | null;
  countryRegion: string | null;
  momentumScore: number;
  currentStreak: number;
  connection: {
    connectionId: string;
    status: string;
    direction: "sent" | "received";
  } | null;
}

interface UserSearchModalProps {
  open: boolean;
  onClose: () => void;
  onConnected: (userName: string) => void;
  onViewProfile: (userId: string, connectionStatus: SearchUser["connection"]) => void;
}

export function UserSearchModal({ open, onClose, onConnected, onViewProfile }: UserSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { users: SearchUser[] };
      setResults(data.users);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void search(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  const handleSendRequest = async (user: SearchUser) => {
    if (pendingIds.has(user.id)) return;
    setPendingIds((prev) => new Set(prev).add(user.id));
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username ?? undefined, email: undefined }),
      });
      const data = (await res.json()) as { status?: string; error?: string };
      if (!res.ok) {
        toast(data.error ?? "Failed to send request", "error");
        setPendingIds((prev) => { const s = new Set(prev); s.delete(user.id); return s; });
        return;
      }
      if (data.status === "accepted" || data.status === "already_friends") {
        toast("Connected ✓");
        onConnected(user.name ?? user.username ?? "them");
        // Update local result
        setResults((prev) =>
          prev.map((u) =>
            u.id === user.id
              ? { ...u, connection: { connectionId: "", status: "accepted", direction: "sent" } }
              : u
          )
        );
      } else {
        toast("Request sent ✓");
        setResults((prev) =>
          prev.map((u) =>
            u.id === user.id
              ? { ...u, connection: { connectionId: "", status: "pending", direction: "sent" } }
              : u
          )
        );
      }
    } catch {
      toast("Failed to send request", "error");
      setPendingIds((prev) => { const s = new Set(prev); s.delete(user.id); return s; });
    }
  };

  function ConnectionChip({ user }: { user: SearchUser }) {
    const conn = user.connection;
    if (!conn) {
      return (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); void handleSendRequest(user); }}
          disabled={pendingIds.has(user.id)}
          className="flex h-8 items-center gap-1.5 rounded-xl border border-ink/20 bg-ink px-3 text-xs font-semibold text-cream-paper transition hover:opacity-80 disabled:opacity-50"
        >
          <UserPlus className="h-3 w-3" />
          Add
        </button>
      );
    }
    if (conn.status === "accepted") {
      return (
        <span className="flex h-8 items-center gap-1 rounded-xl border border-sage/30 bg-sage/10 px-3 text-xs font-semibold text-sage">
          <Check className="h-3 w-3" />
          Connected
        </span>
      );
    }
    if (conn.status === "pending" && conn.direction === "sent") {
      return (
        <span className="flex h-8 items-center gap-1 rounded-xl border border-cream-dark bg-cream px-3 text-xs font-semibold text-ink-muted">
          <Clock className="h-3 w-3" />
          Pending
        </span>
      );
    }
    if (conn.status === "pending" && conn.direction === "received") {
      return (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); void handleSendRequest(user); }}
          className="flex h-8 items-center gap-1.5 rounded-xl border border-gold/40 bg-gold/10 px-3 text-xs font-semibold text-gold transition hover:bg-gold/20"
        >
          <Check className="h-3 w-3" />
          Accept
        </button>
      );
    }
    return null;
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-end bg-[rgba(26,23,20,0.55)] backdrop-blur-sm sm:items-center sm:justify-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ y: 32, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="mobile-sheet w-full bg-cream-paper sm:max-w-lg sm:rounded-3xl"
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-cream-dark px-5 py-4">
              <Search className="h-4 w-4 flex-shrink-0 text-ink-muted" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or email…"
                className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="text-ink-muted hover:text-ink">
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="ml-1 flex h-8 w-8 items-center justify-center rounded-xl border border-cream-dark text-ink-muted hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Results */}
            <div
              className="overflow-y-auto overscroll-contain"
              style={{ maxHeight: "min(420px, calc(100dvh - 180px))" }}
            >
              {loading && (
                <div className="py-8 text-center text-sm text-ink-muted">Searching…</div>
              )}

              {!loading && query.length >= 2 && results.length === 0 && (
                <div className="py-10 text-center">
                  <p className="text-3xl">🔍</p>
                  <p className="mt-2 text-sm text-ink-muted">No users found for &ldquo;{query}&rdquo;</p>
                </div>
              )}

              {!loading && query.length < 2 && (
                <div className="py-8 text-center text-sm text-ink-muted">
                  Type at least 2 characters to search
                </div>
              )}

              <div className="divide-y divide-cream-dark">
                {results.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => onViewProfile(user.id, user.connection)}
                    className={cn(
                      "flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-cream/60",
                    )}
                  >
                    {/* Avatar */}
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gold text-xs font-bold text-ink">
                      {user.image
                        ? <img src={user.image} alt={user.name ?? ""} className="h-full w-full object-cover" />
                        : initials(user.name)
                      }
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {user.name ?? `@${user.username}`}
                      </p>
                      <p className="truncate text-xs text-ink-muted">
                        {[user.jobTitle, user.location].filter(Boolean).join(" · ") || (user.username ? `@${user.username}` : "")}
                      </p>
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-2">
                      <ConnectionChip user={user} />
                      <ChevronRight className="h-3.5 w-3.5 text-ink-muted" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer safe area */}
            <div className="h-[env(safe-area-inset-bottom,0px)]" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
