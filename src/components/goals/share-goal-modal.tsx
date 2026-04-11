"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Mail, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toaster";
import { cn, initials } from "@/lib/utils";

interface ShareGoalModalProps {
  goalId: string;
  goalTitle: string;
  open: boolean;
  onClose: () => void;
  circleMembers: Array<{
    id: string;
    name: string | null;
    image: string | null;
    streak: number;
  }>;
  sharedMemberIds: string[];
}

export function ShareGoalModal({
  goalId,
  goalTitle,
  open,
  onClose,
  circleMembers,
  sharedMemberIds,
}: ShareGoalModalProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [sharingSelection, setSharingSelection] = useState(false);

  const sharedSet = new Set(sharedMemberIds);

  const toggleMember = (memberId: string) => {
    if (sharedSet.has(memberId)) {
      return;
    }

    setSelectedIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId]
    );
  };

  const handleSendInvite = async () => {
    if (!email.trim() || sendingInvite) {
      return;
    }

    setSendingInvite(true);
    try {
      const response = await fetch(`/api/goals/${goalId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to send invite");
      }

      toast("Invite sent ✓");
      setEmail("");
      router.refresh();
    } catch {
      toast("Failed to send invite", "error");
    } finally {
      setSendingInvite(false);
    }
  };

  const handleAddSelected = async () => {
    if (selectedIds.length === 0 || sharingSelection) {
      return;
    }

    setSharingSelection(true);
    try {
      const response = await fetch(`/api/goals/${goalId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedUserIds: selectedIds }),
      });

      if (!response.ok) {
        throw new Error("Failed to share goal");
      }

      toast("Added to your circle ✓");
      setSelectedIds([]);
      router.refresh();
      onClose();
    } catch {
      toast("Failed to add selected people", "error");
    } finally {
      setSharingSelection(false);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[75] flex items-end bg-[rgba(26,23,20,0.58)] backdrop-blur-md lg:items-center lg:justify-center lg:p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
        >
          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="mobile-sheet w-full bg-cream-paper shadow-modal lg:max-w-2xl"
          >
            <div className="flex items-center justify-between border-b border-cream-dark px-5 py-4 lg:px-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
                  Add to Circle
                </p>
                <h2 className="mt-2 text-2xl font-serif font-semibold text-ink">
                  Add to Circle
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cream-dark bg-white/80 text-ink-muted transition-colors hover:text-ink"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6 px-5 py-5 lg:px-6 lg:py-6">
              <p className="text-sm leading-6 text-ink-soft">
                Share <strong>{goalTitle}</strong> with people in your accountability
                circle, or invite someone new by email.
              </p>

              <div className="rounded-[1.5rem] border border-cream-dark bg-white/80 p-4">
                <label className="form-label">Invite by Email</label>
                <div className="mt-2 flex flex-col gap-3 lg:flex-row">
                  <label className="flex min-h-[48px] flex-1 items-center gap-3 rounded-2xl border border-cream-dark bg-white px-4">
                    <Mail className="h-4 w-4 text-ink-muted" />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="friend@example.com"
                      className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleSendInvite}
                    disabled={!email.trim() || sendingInvite}
                    className="btn-primary min-h-[48px] rounded-2xl px-5 disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                    {sendingInvite ? "Sending..." : "Send Invite"}
                  </button>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-cream-dark bg-white/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="form-label mb-0">Select from Your Circle</p>
                    <p className="mt-2 text-sm text-ink-muted">
                      Choose existing members who should see this goal.
                    </p>
                  </div>
                  <span className="rounded-full border border-cream-dark bg-cream-paper px-3 py-1 text-xs font-mono text-ink-muted">
                    {selectedIds.length} selected
                  </span>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {circleMembers.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-cream-dark px-4 py-5 text-sm italic text-ink-muted lg:col-span-2">
                      No accepted circle members yet. Send an invite above to start your circle.
                    </p>
                  ) : (
                    circleMembers.map((member) => {
                      const selected = selectedIds.includes(member.id);
                      const alreadyShared = sharedSet.has(member.id);

                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => toggleMember(member.id)}
                          className={cn(
                            "flex min-h-[64px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
                            alreadyShared
                              ? "border-gold/30 bg-gold/10 text-ink"
                              : selected
                              ? "border-ink bg-ink text-cream-paper"
                              : "border-cream-dark bg-cream-paper text-ink hover:border-ink-muted"
                          )}
                        >
                          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gold text-sm font-bold text-ink">
                            {member.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={member.image}
                                alt={member.name ?? ""}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              initials(member.name)
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {member.name ?? "Circle member"}
                            </span>
                            <span
                              className={cn(
                                "mt-1 block text-xs",
                                selected || alreadyShared
                                  ? "opacity-70"
                                  : "text-ink-muted"
                              )}
                            >
                              {member.streak > 0 ? `🔥 ${member.streak} streak` : "Ready to follow along"}
                            </span>
                          </span>
                          {alreadyShared ? (
                            <span className="rounded-full border border-gold/20 bg-white/60 px-3 py-1 text-xs font-semibold text-gold">
                              Added
                            </span>
                          ) : selected ? (
                            <Check className="h-4 w-4" />
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 lg:flex-row lg:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary min-h-[48px] rounded-2xl px-5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddSelected}
                  disabled={selectedIds.length === 0 || sharingSelection}
                  className="btn-primary min-h-[48px] rounded-2xl px-5 disabled:opacity-40"
                >
                  {sharingSelection ? "Adding..." : "Add Selected"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
