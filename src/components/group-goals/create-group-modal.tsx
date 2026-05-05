"use client";

// src/components/group-goals/create-group-modal.tsx
// Progressive-disclosure group creation wizard (3 steps, goal-wizard UX parity).
//   Step 1 — Identity  (cover emoji, name, description, category)
//   Step 2 — Privacy   (public vs private, member cap)
//   Step 3 — Invite    (circle friends, email, optional first goal)
//   Success — Share    (copy link, share, open group)

import { useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, ChevronLeft, Check, Globe, Lock, Search, UserPlus,
  Mail, Plus, Share2, Copy, Users, Target, ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/index";
import { toast } from "@/components/ui/toaster";
import type { InvitableFriend } from "@/server/services/groups.service";

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  invitableFriends?: InvitableFriend[];
}

const GROUP_CATEGORIES = [
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
] as const;

const COVER_EMOJIS = [
  "🏆","🌍","🚀","💡","🔥","🌱","⚡","🎯",
  "🏃","📖","💪","🎨","🤝","🧠","🌟","💰",
  "🔬","🎵","✨","🌈","🦁","🌊","🎭","🏔️",
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center:                  { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

function Avatar({ name, image }: { name: string | null; image?: string | null }) {
  const inits = name
    ? name.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")
    : "?";
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold/20 text-[0.6rem] font-bold text-gold">
      {image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={image} alt={name ?? ""} className="h-full w-full object-cover" />
        : inits}
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            width: i + 1 === step ? 20 : 6,
            backgroundColor: i + 1 < step ? "#6b8c7a" : i + 1 === step ? "#C4963A" : "#d4c9b0",
          }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className="h-1.5 rounded-full"
        />
      ))}
    </div>
  );
}

// ─── Section block ────────────────────────────────────────────────────────────

function Section({
  num,
  title,
  children,
}: {
  num: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/15 text-[11px] font-bold text-gold">
          {num}
        </span>
        <p className="text-sm font-semibold text-ink">{title}</p>
      </div>
      {children}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function CreateGroupModal({ open, onClose, invitableFriends = [] }: CreateGroupModalProps) {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);
  const [saving, setSaving] = useState(false);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [createdGroupName, setCreatedGroupName] = useState("");

  // ── Step 1 fields ──
  const [coverEmoji, setCoverEmoji] = useState("🏆");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

  // ── Step 2 fields ──
  const [type, setType] = useState<"public" | "private">("public");
  const [memberCap, setMemberCap] = useState("");

  // ── Step 3 fields ──
  const [friendSearch, setFriendSearch] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [addFirstGoal, setAddFirstGoal] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  function go(next: number) {
    setDir(next > step ? 1 : -1);
    setStep(next);
  }

  function reset() {
    setStep(1); setDir(1); setSaving(false); setCreatedGroupId(null);
    setCoverEmoji("🏆"); setName(""); setDescription(""); setCategory("");
    setType("public"); setMemberCap("");
    setFriendSearch(""); setSelectedFriendIds([]); setEmailInput(""); setInviteEmails([]);
    setAddFirstGoal(false);
  }

  function handleClose() { reset(); onClose(); }

  function toggleFriend(id: string) {
    setSelectedFriendIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }

  function addEmail() {
    const val = emailInput.trim().toLowerCase();
    if (!val) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { toast("Enter a valid email.", "error"); return; }
    if (inviteEmails.includes(val)) { toast("Already added.", "error"); return; }
    setInviteEmails((p) => [...p, val]);
    setEmailInput("");
    emailRef.current?.focus();
  }

  const filteredFriends = invitableFriends.filter((f) => {
    const q = friendSearch.toLowerCase();
    return !q || f.name?.toLowerCase().includes(q) || f.username?.toLowerCase().includes(q) || f.email.toLowerCase().includes(q);
  });

  const capNum = memberCap ? parseInt(memberCap, 10) : null;
  const capValid = !memberCap || (capNum !== null && capNum >= 2 && capNum <= 10000);
  const step1Valid = name.trim().length >= 2;
  const totalInvited = selectedFriendIds.length + inviteEmails.length;

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
          memberCap: capNum ?? undefined,
          inviteUserIds: selectedFriendIds,
          inviteEmails,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Failed to create group");
      }
      const d = (await res.json()) as { group?: { id?: string } };
      const newId = d.group?.id ?? null;
      setCreatedGroupId(newId);
      setCreatedGroupName(name.trim());
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleShare() {
    if (!createdGroupId) return;
    const link = `${window.location.origin}/groups/community/${createdGroupId}`;
    if (navigator.share) {
      await navigator.share({ title: createdGroupName, url: link }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(link).catch(() => {});
      toast("Link copied! 🔗");
    }
  }

  if (!open) return null;

  // ── Success state ──────────────────────────────────────────────────────────
  if (createdGroupId) {
    const link = `${typeof window !== "undefined" ? window.location.origin : ""}/groups/community/${createdGroupId}`;
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
        <motion.div
          className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          onClick={handleClose}
        />
        <motion.div
          className="relative z-10 w-full max-w-md rounded-t-[2rem] bg-cream-paper shadow-2xl sm:rounded-[2rem]"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 sm:hidden">
            <div className="h-1 w-10 rounded-full bg-cream-dark" />
          </div>

          <div className="px-7 py-8 text-center space-y-6">
            {/* Icon */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 280 }}
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gold/15 text-5xl shadow-sm"
            >
              {coverEmoji}
            </motion.div>

            <div>
              <h2 className="font-serif text-2xl font-bold text-ink">{createdGroupName}</h2>
              <p className="mt-1 text-sm text-ink-muted">Your group is live — share it to get members in!</p>
            </div>

            {/* Link card */}
            <div className="flex items-center gap-2 rounded-2xl border border-cream-dark bg-cream px-4 py-3">
              <p className="flex-1 truncate text-xs text-ink-muted">{link}</p>
              <button
                type="button"
                onClick={() => { void navigator.clipboard.writeText(link); toast("Copied! 🔗"); }}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-ink px-3 py-1.5 text-xs font-semibold text-cream-paper transition hover:opacity-80"
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => void handleShare()}
                className="btn-gold flex w-full items-center justify-center gap-2"
              >
                <Share2 className="h-4 w-4" />
                Share Invite Link
              </button>

              {addFirstGoal && (
                <button
                  type="button"
                  onClick={() => {
                    router.push(`/goals/new?groupId=${createdGroupId}`);
                    handleClose();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gold/40 bg-gold/8 px-5 py-3 text-sm font-semibold text-ink transition hover:bg-gold/15"
                >
                  <Target className="h-4 w-4 text-gold" />
                  Add First Group Goal
                  <ArrowRight className="h-3.5 w-3.5 text-ink-muted" />
                </button>
              )}

              <button
                type="button"
                onClick={() => { router.push(`/groups/community/${createdGroupId}`); handleClose(); }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cream-dark bg-cream py-3 text-sm font-semibold text-ink transition hover:bg-cream-dark"
              >
                Open Group →
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="text-sm text-ink-muted transition hover:text-ink"
              >
                Done
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Wizard ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <motion.div
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        onClick={handleClose}
      />

      <motion.div
        className="relative z-10 flex w-full max-w-md flex-col rounded-t-[2rem] bg-cream-paper shadow-2xl sm:rounded-[2rem]"
        style={{ maxHeight: "92dvh" }}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-cream-dark" />
        </div>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => go(step - 1)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cream-dark text-ink-muted transition hover:bg-cream-dark/70"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : (
            <div className="h-8 w-8" />
          )}

          <div className="flex-1 text-center">
            <StepDots step={step} total={3} />
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition hover:bg-cream-dark"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Progress bar ─────────────────────────────────────────────── */}
        <div className="mx-6 mb-1 h-0.5 overflow-hidden rounded-full bg-cream-dark">
          <motion.div
            className="h-full rounded-full bg-gold"
            animate={{ width: `${(step / 3) * 100}%` }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
          />
        </div>

        {/* ── Step title ─────────────────────────────────────────────── */}
        <div className="px-6 pb-4 pt-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">
                Step {step} of 3
              </p>
              <h2 className="mt-0.5 font-serif text-xl font-bold text-ink">
                {step === 1 && "Group Identity"}
                {step === 2 && "Privacy & Access"}
                {step === 3 && "Invite & Launch"}
              </h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                {step === 1 && "Name your group and pick a category to help people find you."}
                {step === 2 && "Choose who can join and set an optional member limit."}
                {step === 3 && "Invite from your circle and optionally set a first group goal."}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Step content ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6">
          <AnimatePresence mode="wait" custom={dir}>

            {/* ────────────────── STEP 1: Identity ────────────────────── */}
            {step === 1 && (
              <motion.div
                key="s1"
                custom={dir}
                variants={slideVariants}
                initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="space-y-6 pb-6"
              >
                {/* Cover emoji */}
                <Section num={1} title="Pick an icon">
                  <div className="flex flex-wrap gap-2">
                    {COVER_EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setCoverEmoji(e)}
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl border text-xl transition-all duration-150",
                          coverEmoji === e
                            ? "border-gold bg-gold/12 shadow-sm ring-1 ring-gold/30"
                            : "border-cream-dark hover:border-gold/50 hover:bg-gold/5"
                        )}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Name */}
                <Section num={2} title="Group name">
                  <input
                    id="group-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Morning Runners Club"
                    maxLength={80}
                    autoFocus
                    className="input w-full"
                  />
                  <p className="text-right text-[0.68rem] text-ink-muted">{name.length}/80</p>
                </Section>

                {/* Description */}
                <Section num={3} title="Description (optional)">
                  <textarea
                    id="group-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this group about? Who should join?"
                    maxLength={500}
                    rows={3}
                    className="input w-full resize-none"
                  />
                  <p className="text-right text-[0.68rem] text-ink-muted">{description.length}/500</p>
                </Section>

                {/* Category */}
                <Section num={4} title="Category">
                  <div className="flex flex-wrap gap-2">
                    {GROUP_CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setCategory(cat.value === category ? "" : cat.value)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                          category === cat.value
                            ? "border-gold bg-gold/10 text-ink shadow-sm"
                            : "border-cream-dark bg-cream-paper text-ink-muted hover:border-gold/40 hover:text-ink"
                        )}
                      >
                        {cat.emoji} {cat.label}
                        {category === cat.value && <Check className="h-3 w-3 text-gold" />}
                      </button>
                    ))}
                  </div>
                </Section>
              </motion.div>
            )}

            {/* ────────────────── STEP 2: Privacy ─────────────────────── */}
            {step === 2 && (
              <motion.div
                key="s2"
                custom={dir}
                variants={slideVariants}
                initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="space-y-6 pb-6"
              >
                {/* Public/Private */}
                <Section num={1} title="Who can join?">
                  <div className="grid grid-cols-2 gap-3">
                    {(["public", "private"] as const).map((t) => {
                      const sel = type === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setType(t)}
                          className={cn(
                            "group relative flex flex-col gap-2 rounded-2xl border p-4 text-left transition-all duration-150",
                            sel
                              ? "border-gold bg-gold/8 shadow-sm"
                              : "border-cream-dark bg-cream-paper hover:border-gold/40"
                          )}
                        >
                          {/* Check */}
                          <div className={cn(
                            "absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full border-2 transition-all",
                            sel ? "border-gold bg-gold" : "border-cream-dark"
                          )}>
                            {sel && <Check className="h-2.5 w-2.5 text-ink" />}
                          </div>

                          <div className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                            sel ? "bg-gold/20 text-gold" : "bg-cream-dark text-ink-muted"
                          )}>
                            {t === "public" ? <Globe className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                          </div>

                          <div>
                            <p className={cn("text-sm font-bold", sel ? "text-ink" : "text-ink-muted")}>
                              {t === "public" ? "Public" : "Private"}
                            </p>
                            <p className="mt-0.5 text-[0.67rem] leading-snug text-ink-muted">
                              {t === "public"
                                ? "Anyone can discover & join instantly"
                                : "Invite-only — you approve every member"}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Section>

                {/* Member cap */}
                <Section num={2} title="Member limit (optional)">
                  <div className="flex items-center gap-3 rounded-2xl border border-cream-dark bg-cream p-4">
                    <Users className="h-5 w-5 shrink-0 text-ink-muted" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-ink">Max members</p>
                      <p className="text-[0.67rem] text-ink-muted">Leave blank for unlimited</p>
                    </div>
                    <input
                      type="number"
                      min={2}
                      max={10000}
                      value={memberCap}
                      onChange={(e) => setMemberCap(e.target.value)}
                      placeholder="∞"
                      className="w-20 rounded-xl border border-cream-dark bg-cream-paper px-3 py-2 text-center text-sm font-semibold text-ink outline-none focus:border-gold"
                    />
                  </div>
                  {!capValid && (
                    <p className="text-xs text-rose-600">Enter a number between 2 and 10,000</p>
                  )}
                </Section>

                {/* Visibility summary */}
                <div className={cn(
                  "rounded-2xl border px-4 py-3 text-xs leading-relaxed",
                  type === "public"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                )}>
                  {type === "public"
                    ? "🌍 Your group will appear in Discover. Anyone can join without approval."
                    : "🔒 Your group stays hidden. Share the link directly to invite people."}
                </div>
              </motion.div>
            )}

            {/* ────────────────── STEP 3: Invite & Launch ──────────────── */}
            {step === 3 && (
              <motion.div
                key="s3"
                custom={dir}
                variants={slideVariants}
                initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="space-y-6 pb-6"
              >
                {/* Summary preview chip */}
                <div className="flex items-center gap-3 rounded-2xl border border-cream-dark bg-cream px-4 py-3">
                  <span className="text-2xl">{coverEmoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{name}</p>
                    <p className="text-[0.67rem] capitalize text-ink-muted">
                      {type} · {category || "No category"}
                      {memberCap ? ` · max ${memberCap}` : ""}
                    </p>
                  </div>
                  {type === "public"
                    ? <Globe className="h-4 w-4 shrink-0 text-emerald-500" />
                    : <Lock className="h-4 w-4 shrink-0 text-ink-muted" />}
                </div>

                {/* Circle invites */}
                <Section num={1} title="Invite from your Circle">
                  {invitableFriends.length === 0 ? (
                    <div className="rounded-2xl bg-cream-dark/50 px-4 py-4 text-center text-sm text-ink-muted">
                      <UserPlus className="mx-auto mb-2 h-5 w-5 opacity-50" />
                      No circle friends yet — add friends from the Circle page.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
                        <input
                          type="text"
                          value={friendSearch}
                          onChange={(e) => setFriendSearch(e.target.value)}
                          placeholder="Search name or username…"
                          className="input w-full pl-8"
                        />
                      </div>
                      <div className="max-h-36 space-y-1 overflow-y-auto rounded-2xl border border-cream-dark bg-cream-paper/60 p-1.5">
                        {filteredFriends.length === 0 ? (
                          <p className="py-2 text-center text-xs text-ink-muted">No matches</p>
                        ) : filteredFriends.map((f) => {
                          const sel = selectedFriendIds.includes(f.id);
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => toggleFriend(f.id)}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                                sel ? "bg-gold/10" : "hover:bg-cream-dark/40"
                              )}
                            >
                              <Avatar name={f.name} image={f.image} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-ink">
                                  {f.name ?? f.username ?? f.email}
                                </p>
                                {f.username && (
                                  <p className="truncate text-xs text-ink-muted">@{f.username}</p>
                                )}
                              </div>
                              <div className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                                sel ? "border-gold bg-gold" : "border-cream-dark"
                              )}>
                                {sel && <Check className="h-3 w-3 text-ink" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {selectedFriendIds.length > 0 && (
                        <p className="text-xs text-ink-muted">
                          {selectedFriendIds.length} friend{selectedFriendIds.length > 1 ? "s" : ""} selected
                        </p>
                      )}
                    </div>
                  )}
                </Section>

                {/* Email invites */}
                <Section num={2} title="Invite by email">
                  <div className="flex gap-2">
                    <input
                      ref={emailRef}
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
                      placeholder="friend@example.com"
                      className="input min-w-0 flex-1"
                    />
                    <button
                      type="button"
                      onClick={addEmail}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cream-dark bg-cream-paper text-ink-muted transition hover:border-gold hover:text-gold"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  {inviteEmails.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {inviteEmails.map((email) => (
                        <span
                          key={email}
                          className="flex items-center gap-1.5 rounded-full bg-cream-dark px-3 py-1 text-xs text-ink"
                        >
                          <Mail className="h-3 w-3 text-ink-muted" />
                          {email}
                          <button
                            type="button"
                            onClick={() => setInviteEmails((p) => p.filter((e) => e !== email))}
                            className="text-ink-muted hover:text-ink"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </Section>

                {/* First group goal toggle */}
                <Section num={3} title="Add a first group goal?">
                  <button
                    type="button"
                    onClick={() => setAddFirstGoal(!addFirstGoal)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all duration-150",
                      addFirstGoal ? "border-gold bg-gold/8" : "border-cream-dark bg-cream hover:border-gold/40"
                    )}
                  >
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                      addFirstGoal ? "bg-gold/20 text-gold" : "bg-cream-dark text-ink-muted"
                    )}>
                      <Target className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-ink">Set a shared goal</p>
                      <p className="text-[0.67rem] text-ink-muted">
                        After creating the group, you&apos;ll be taken to the goal creator with this group pre-selected.
                      </p>
                    </div>
                    <div className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                      addFirstGoal ? "border-gold bg-gold" : "border-cream-dark"
                    )}>
                      {addFirstGoal && <Check className="h-3 w-3 text-ink" />}
                    </div>
                  </button>
                </Section>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Footer CTA ────────────────────────────────────────────────── */}
        <div className="shrink-0 space-y-2.5 border-t border-cream-dark px-6 py-4">
          {step < 3 ? (
            <button
              type="button"
              disabled={step === 1 ? !step1Valid : !capValid}
              onClick={() => go(step + 1)}
              className="btn-gold w-full"
            >
              Continue →
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleCreate()}
                className="btn-gold w-full"
              >
                {saving
                  ? "Creating…"
                  : totalInvited > 0
                    ? `Create & Invite ${totalInvited}`
                    : "Create Group"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleCreate()}
                className="w-full text-center text-sm text-ink-muted transition hover:text-ink"
              >
                Skip invites for now →
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
