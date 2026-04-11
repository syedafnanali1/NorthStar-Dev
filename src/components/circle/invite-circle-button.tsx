"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { toast } from "@/components/ui/toaster";

export function InviteCircleButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSendInvite() {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return;

    setSending(true);
    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to send invite");
      }

      toast("Invite sent. They will receive a signup link by email.", "success");
      setEmail("");
      setOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to send invite", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary min-h-[48px] rounded-2xl px-5 lg:min-h-0 lg:rounded-full lg:px-6"
      >
        <span className="text-base leading-none">+</span> Invite
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40"
            aria-label="Close invite modal"
          />
          <div className="relative w-full max-w-md rounded-3xl bg-cream-paper p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1 text-ink-muted transition hover:bg-cream hover:text-ink"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
              Invite Someone
            </p>
            <h3 className="mt-2 font-serif text-xl font-semibold text-ink">
              Send an email invite
            </h3>
            <p className="mt-2 text-sm text-ink-muted">
              They will get an email with a secure link to sign up and join your circle.
            </p>

            <div className="mt-5 space-y-2">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="friend@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleSendInvite();
                  }
                }}
                autoFocus
              />
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              <Link href="/profile#invite" className="text-xs font-medium text-ink-muted hover:text-ink">
                More invite options
              </Link>
              <button
                type="button"
                onClick={() => void handleSendInvite()}
                disabled={sending || !email.trim()}
                className="btn-primary disabled:opacity-40"
              >
                {sending ? "Sending..." : "Send Invite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
