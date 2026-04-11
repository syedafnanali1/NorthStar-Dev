"use client";

// src/components/group-goals/create-group-modal.tsx
// 3-step group creation wizard:
//   Step 1 — Group Details  (name, description, public/private)
//   Step 2 — Invite Members (circle friends + email invites)
//   Step 3 — Confirmation   (summary → Create)

import { useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ChevronLeft, Check, Globe, Lock, Search, UserPlus, Mail, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/index";
import { toast } from "@/components/ui/toaster";
import type { InvitableFriend } from "@/server/services/group-goals.service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  invitableFriends?: InvitableFriend[];
}

// ─── Step animation variants ─────────────────────────────────────────────────

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
};

// ─── Avatar initials helper ──────────────────────────────────────────────────

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CreateGroupModal({
  open,
  onClose,
  invitableFriends = [],
}: CreateGroupModalProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1); // 1 = forward, -1 = back
  const [saving, setSaving] = useState(false);

  // Step 1 state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"public" | "private">("public");
  const [category, setCategory] = useState<string>("");

  // Step 2 state
  const [friendSearch, setFriendSearch] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function go(next: number) {
    setDir(next > step ? 1 : -1);
    setStep(next);
  }

  function reset() {
    setStep(1);
    setDir(1);
    setName("");
    setDescription("");
    setType("public");
    setCategory("");
    setFriendSearch("");
    setSelectedFriendIds([]);
    setEmailInput("");
    setInviteEmails([]);
    setSaving(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function toggleFriend(id: string) {
    setSelectedFriendIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function addEmail() {
    const val = emailInput.trim().toLowerCase();
    if (!val) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      toast("Enter a valid email address.", "error");
      return;
    }
    if (inviteEmails.includes(val)) {
      toast("Email already added.", "error");
      return;
    }
    setInviteEmails((prev) => [...prev, val]);
    setEmailInput("");
    emailInputRef.current?.focus();
  }

  function removeEmail(email: string) {
    setInviteEmails((prev) => prev.filter((e) => e !== email));
  }

  const filteredFriends = invitableFriends.filter((f) => {
    const q = friendSearch.toLowerCase();
    return (
      !q ||
      f.name?.toLowerCase().includes(q) ||
      f.username?.toLowerCase().includes(q) ||
      f.email.toLowerCase().includes(q)
    );
  });

  const totalInvited = selectedFriendIds.length + inviteEmails.length;

  // ── Step 1 validation ─────────────────────────────────────────────────────

  const step1Valid = name.trim().length >= 2;

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          type,
          category: category || undefined,
          inviteUserIds: selectedFriendIds,
          inviteEmails,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to create group");
      }

      toast(`"${name}" created!`, "success");
      router.refresh();
      handleClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong.", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
      />

      {/* Sheet */}
      <motion.div
        className="relative z-10 w-full max-w-lg rounded-t-3xl bg-cream-paper shadow-2xl sm:rounded-3xl"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
      >
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-cream-dark" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => go(step - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-cream-dark text-ink-muted transition-colors hover:bg-cream-dark/70"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <p className="section-label text-gold">
                Step {step} of 3
              </p>
              <h2 className="font-serif text-lg font-semibold text-ink">
                {step === 1 && "Group Details"}
                {step === 2 && "Invite Members"}
                {step === 3 && "Confirm & Create"}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-cream-dark"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mx-6 mb-5 h-1 overflow-hidden rounded-full bg-cream-dark">
          <motion.div
            className="h-full rounded-full bg-gold"
            animate={{ width: `${(step / 3) * 100}%` }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
          />
        </div>

        {/* Step content */}
        <div className="overflow-hidden px-6">
          <AnimatePresence mode="wait" custom={dir}>
            {/* ── STEP 1: Group Details ──────────────────────────────── */}
            {step === 1 && (
              <motion.div
                key="step1"
                custom={dir}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="space-y-5 pb-6"
              >
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="section-label" htmlFor="group-name">
                    Group Name <span className="text-gold">*</span>
                  </label>
                  <input
                    id="group-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Morning Runners Club"
                    maxLength={80}
                    className="input w-full"
                    autoFocus
                  />
                  <p className="text-right text-[0.7rem] text-ink-muted">{name.length}/80</p>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="section-label" htmlFor="group-desc">
                    Description
                  </label>
                  <textarea
                    id="group-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this group about? (optional)"
                    maxLength={500}
                    rows={3}
                    className="input w-full resize-none"
                  />
                  <p className="text-right text-[0.7rem] text-ink-muted">{description.length}/500</p>
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <p className="section-label">Category</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "health",     label: "Health",      emoji: "🌿" },
                      { value: "fitness",    label: "Fitness",     emoji: "💪" },
                      { value: "finance",    label: "Finance",     emoji: "💰" },
                      { value: "mindset",    label: "Mindset",     emoji: "🧠" },
                      { value: "writing",    label: "Writing",     emoji: "✍️" },
                      { value: "reading",    label: "Reading",     emoji: "📚" },
                      { value: "career",     label: "Career",      emoji: "🚀" },
                      { value: "lifestyle",  label: "Lifestyle",   emoji: "🌟" },
                      { value: "creativity", label: "Creativity",  emoji: "🎨" },
                      { value: "community",  label: "Community",   emoji: "🤝" },
                      { value: "other",      label: "Other",       emoji: "✨" },
                    ].map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setCategory(cat.value === category ? "" : cat.value)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                          category === cat.value
                            ? "border-gold bg-gold/10 text-ink"
                            : "border-cream-dark bg-cream-paper text-ink-muted hover:border-gold/40"
                        )}
                      >
                        <span>{cat.emoji}</span>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Type */}
                <div className="space-y-1.5">
                  <p className="section-label">Visibility</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(["public", "private"] as const).map((t) => {
                      const selected = type === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setType(t)}
                          className={cn(
                            "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
                            selected
                              ? "border-gold bg-gold/8 shadow-sm"
                              : "border-cream-dark bg-cream-paper hover:border-gold/40"
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl",
                              selected ? "bg-gold/20 text-gold" : "bg-cream-dark text-ink-muted"
                            )}
                          >
                            {t === "public" ? (
                              <Globe className="h-4 w-4" />
                            ) : (
                              <Lock className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <p className={cn("text-sm font-semibold", selected ? "text-ink" : "text-ink-muted")}>
                              {t === "public" ? "Public" : "Private"}
                            </p>
                            <p className="text-[0.7rem] text-ink-muted leading-snug">
                              {t === "public" ? "Anyone can discover & request to join" : "Invite only"}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!step1Valid}
                  onClick={() => go(2)}
                  className="btn-gold w-full"
                >
                  Continue →
                </button>
              </motion.div>
            )}

            {/* ── STEP 2: Invite Members ─────────────────────────────── */}
            {step === 2 && (
              <motion.div
                key="step2"
                custom={dir}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="space-y-5 pb-6"
              >
                {/* Friend search */}
                <div className="space-y-2">
                  <p className="section-label flex items-center gap-1.5">
                    <UserPlus className="h-3.5 w-3.5" />
                    Invite from your Circle
                  </p>

                  {invitableFriends.length === 0 ? (
                    <p className="rounded-xl bg-cream-dark/50 px-4 py-3 text-sm text-ink-muted">
                      No circle friends yet. Add friends from the Circle page first.
                    </p>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
                        <input
                          type="text"
                          value={friendSearch}
                          onChange={(e) => setFriendSearch(e.target.value)}
                          placeholder="Search by name or username…"
                          className="input w-full pl-8"
                        />
                      </div>

                      <div className="max-h-44 space-y-1 overflow-y-auto rounded-2xl border border-cream-dark bg-cream-paper/60 p-1.5">
                        {filteredFriends.length === 0 ? (
                          <p className="py-2 text-center text-xs text-ink-muted">No matches</p>
                        ) : (
                          filteredFriends.map((friend) => {
                            const selected = selectedFriendIds.includes(friend.id);
                            return (
                              <button
                                key={friend.id}
                                type="button"
                                onClick={() => toggleFriend(friend.id)}
                                className={cn(
                                  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                                  selected
                                    ? "bg-gold/10"
                                    : "hover:bg-cream-dark/40"
                                )}
                              >
                                {friend.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={friend.image}
                                    alt={friend.name ?? ""}
                                    className="h-7 w-7 flex-shrink-0 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gold/20 text-[0.6rem] font-bold text-gold">
                                    {initials(friend.name)}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-ink">
                                    {friend.name ?? friend.username ?? friend.email}
                                  </p>
                                  {friend.username && (
                                    <p className="truncate text-xs text-ink-muted">@{friend.username}</p>
                                  )}
                                </div>
                                <div
                                  className={cn(
                                    "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all",
                                    selected
                                      ? "border-gold bg-gold"
                                      : "border-cream-dark bg-transparent"
                                  )}
                                >
                                  {selected && <Check className="h-3 w-3 text-ink" />}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Email invites */}
                <div className="space-y-2">
                  <p className="section-label flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Invite by Email
                  </p>

                  <div className="flex gap-2">
                    <input
                      ref={emailInputRef}
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addEmail();
                        }
                      }}
                      placeholder="friend@example.com"
                      className="input min-w-0 flex-1"
                    />
                    <button
                      type="button"
                      onClick={addEmail}
                      className="btn-secondary flex-shrink-0 px-3"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  {inviteEmails.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {inviteEmails.map((email) => (
                        <span
                          key={email}
                          className="flex items-center gap-1.5 rounded-full bg-cream-dark px-3 py-1 text-xs text-ink"
                        >
                          {email}
                          <button
                            type="button"
                            onClick={() => removeEmail(email)}
                            className="text-ink-muted hover:text-ink"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => go(3)}
                  className="btn-gold w-full"
                >
                  {totalInvited > 0 ? `Continue with ${totalInvited} invite${totalInvited > 1 ? "s" : ""} →` : "Continue →"}
                </button>
              </motion.div>
            )}

            {/* ── STEP 3: Confirmation ───────────────────────────────── */}
            {step === 3 && (
              <motion.div
                key="step3"
                custom={dir}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="space-y-5 pb-6"
              >
                {/* Summary card */}
                <div className="overflow-hidden rounded-2xl border border-cream-dark bg-cream-paper">
                  <div className="border-b border-cream-dark bg-cream-dark/30 px-5 py-4">
                    <p className="font-serif text-xl font-semibold text-ink">{name}</p>
                    {description && (
                      <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>
                    )}
                  </div>

                  <div className="divide-y divide-cream-dark">
                    <div className="flex items-center justify-between px-5 py-3">
                      <span className="text-sm text-ink-muted">Visibility</span>
                      <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                        {type === "public" ? (
                          <>
                            <Globe className="h-3.5 w-3.5 text-gold" />
                            Public
                          </>
                        ) : (
                          <>
                            <Lock className="h-3.5 w-3.5 text-gold" />
                            Private
                          </>
                        )}
                      </span>
                    </div>

                    {category && (
                      <div className="flex items-center justify-between px-5 py-3">
                        <span className="text-sm text-ink-muted">Category</span>
                        <span className="text-sm font-medium capitalize text-ink">{category}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between px-5 py-3">
                      <span className="text-sm text-ink-muted">Members invited</span>
                      <span className="text-sm font-medium text-ink">{totalInvited}</span>
                    </div>

                    {selectedFriendIds.length > 0 && (
                      <div className="px-5 py-3">
                        <p className="mb-2 text-xs text-ink-muted">From your circle</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedFriendIds.map((id) => {
                            const f = invitableFriends.find((fr) => fr.id === id);
                            if (!f) return null;
                            return (
                              <span
                                key={id}
                                className="flex items-center gap-1.5 rounded-full bg-cream-dark px-2.5 py-1 text-xs font-medium text-ink"
                              >
                                {f.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={f.image} alt="" className="h-4 w-4 rounded-full object-cover" />
                                ) : (
                                  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-gold/20 text-[0.5rem] font-bold text-gold">
                                    {initials(f.name)}
                                  </div>
                                )}
                                {f.name ?? f.username ?? f.email}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {inviteEmails.length > 0 && (
                      <div className="px-5 py-3">
                        <p className="mb-2 text-xs text-ink-muted">Email invites</p>
                        <div className="flex flex-wrap gap-1.5">
                          {inviteEmails.map((e) => (
                            <span
                              key={e}
                              className="rounded-full bg-cream-dark px-2.5 py-1 text-xs text-ink"
                            >
                              {e}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleCreate}
                  className="btn-gold w-full"
                >
                  {saving ? "Creating…" : "Create Group"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
