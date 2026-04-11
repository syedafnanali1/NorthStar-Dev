"use client";

// src/app/groups/[id]/invite-members-panel.tsx

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Link2, Mail, Plus, Send, UserPlus, X } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { initials } from "@/lib/utils/index";

interface SearchUser {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function InviteMembersPanel({ groupGoalId }: { groupGoalId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<SearchUser[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const selectedUserIds = useMemo(
    () => new Set(selectedUsers.map((u) => u.id)),
    [selectedUsers]
  );

  const groupUrl = useMemo(() => {
    if (typeof window !== "undefined") return `${window.location.origin}/groups/${groupGoalId}`;
    return `/groups/${groupGoalId}`;
  }, [groupGoalId]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const ctrl = new AbortController();
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(trimmed)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error("Search failed");
        const data = (await res.json()) as { users?: SearchUser[] };
        setResults((data.users ?? []).filter((u) => !selectedUserIds.has(u.id)));
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) setResults([]);
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => {
      clearTimeout(timeout);
      ctrl.abort();
    };
  }, [query, selectedUserIds]);

  function addUser(user: SearchUser) {
    if (selectedUserIds.has(user.id)) return;
    setSelectedUsers((prev) => [...prev, user]);
    setResults((prev) => prev.filter((u) => u.id !== user.id));
    setQuery("");
  }

  function removeUser(userId: string) {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  }

  function addEmail() {
    const normalized = emailInput.trim().toLowerCase();
    if (!normalized) return;
    if (!isValidEmail(normalized)) {
      toast("Enter a valid email address.", "error");
      return;
    }
    setEmails((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
    setEmailInput("");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(groupUrl);
      toast("Link copied to clipboard.", "success");
    } catch {
      toast("Could not copy link. Please copy manually.", "error");
    }
  }

  async function sendInvites() {
    if (selectedUsers.length === 0 && emails.length === 0) {
      toast("Add at least one user or email first.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/group-goals/${groupGoalId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selectedUsers.map((u) => u.id), emails }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to send invites");
      }
      const payload = (await res.json()) as { invitedUsers: number; emailedInvites: number };
      const parts: string[] = [];
      if (payload.invitedUsers > 0) parts.push(`${payload.invitedUsers} in-app`);
      if (payload.emailedInvites > 0) parts.push(`${payload.emailedInvites} email`);
      toast(
        parts.length > 0 ? `Sent ${parts.join(" and ")} invite${parts.length > 1 ? "s" : ""}.` : "No new invites sent.",
        "success"
      );
      setSelectedUsers([]);
      setEmails([]);
      setEmailInput("");
      setQuery("");
      setResults([]);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to send invites", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cream-dark">
          <UserPlus className="h-3.5 w-3.5 text-ink" />
        </div>
        <h2 className="font-serif text-lg font-semibold text-ink">Invite & Share</h2>
      </div>

      <div className="overflow-hidden rounded-2xl border border-cream-dark bg-cream-paper">
        {/* Share link */}
        <div className="border-b border-cream-dark p-4">
          <p className="section-label mb-2">Share link</p>
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 overflow-hidden rounded-xl border border-cream-dark bg-cream px-3 py-2">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
              <span className="truncate font-mono text-xs text-ink-muted">{groupUrl}</span>
            </div>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-cream-dark px-3 py-2 text-xs font-semibold text-ink transition hover:bg-cream-dark"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </button>
          </div>
        </div>

        {/* Invite users */}
        <div className="border-b border-cream-dark p-4 space-y-3">
          <p className="section-label">Invite existing users</p>
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="form-input"
              placeholder="Search by name or username…"
            />
            {searching && (
              <p className="mt-1.5 text-xs text-ink-muted">Searching…</p>
            )}
            {results.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-cream-dark bg-cream-paper shadow-lg">
                {results.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => addUser(user)}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-cream"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold text-[10px] font-semibold text-ink">
                      {user.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        initials(user.name ?? user.username ?? "U")
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {user.name ?? user.username ?? "User"}
                      </p>
                      {user.username && (
                        <p className="truncate text-xs text-ink-muted">@{user.username}</p>
                      )}
                    </div>
                    <span className="ml-auto text-xs font-semibold text-gold">Add</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected users chips */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((user) => (
                <span
                  key={user.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1 text-xs font-medium text-ink"
                >
                  <div className="flex h-4 w-4 items-center justify-center overflow-hidden rounded-full bg-gold text-[8px] font-bold text-ink">
                    {user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initials(user.name)
                    )}
                  </div>
                  {user.name ?? user.username}
                  <button
                    type="button"
                    onClick={() => removeUser(user.id)}
                    className="text-ink-muted transition hover:text-ink"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Invite by email */}
        <div className="p-4 space-y-3">
          <p className="section-label">Invite by email</p>
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addEmail();
                }
              }}
              placeholder="friend@example.com"
              className="form-input flex-1"
            />
            <button
              type="button"
              onClick={addEmail}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-cream-dark px-3 py-2.5 text-xs font-semibold text-ink transition hover:bg-cream-dark"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>

          {emails.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {emails.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1 text-xs font-medium text-ink"
                >
                  <Mail className="h-3 w-3 text-ink-muted" />
                  {email}
                  <button
                    type="button"
                    onClick={() => setEmails((prev) => prev.filter((e) => e !== email))}
                    className="text-ink-muted transition hover:text-ink"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Send button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void sendInvites()}
              disabled={busy || (selectedUsers.length === 0 && emails.length === 0)}
              className="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream-paper transition hover:opacity-90 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              {busy ? "Sending…" : "Send Invites"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
