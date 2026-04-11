"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";

interface MomentModalProps {
  goalId: string;
  goalTitle: string;
  open: boolean;
  onClose: () => void;
}

const MAX_WORDS = 100;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function MomentModal({ goalId, goalTitle, open, onClose }: MomentModalProps) {
  const [text, setText]                   = useState("");
  const [isPerseverance, setIsPerseverance] = useState(false);
  const [saving, setSaving]               = useState(false);
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wordCount = countWords(text);
  const overLimit = wordCount > MAX_WORDS;

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => textareaRef.current?.focus(), 160);
    return () => window.clearTimeout(timeout);
  }, [open]);

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      setText("");
      setIsPerseverance(false);
    }
  }, [open]);

  const handleSave = async () => {
    if (!text.trim() || overLimit || saving) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/goals/${goalId}/moments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          visibility: "circle",
          isPerseverance,
        }),
      });
      if (!response.ok) throw new Error("Failed to save moment");
      toast(isPerseverance ? "💪 Perseverance moment saved!" : "Moment saved ✓");
      onClose();
      router.refresh();
    } catch {
      toast("Failed to save moment", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end bg-[rgba(26,23,20,0.56)] backdrop-blur-md lg:items-center lg:justify-center lg:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="mobile-sheet w-full bg-cream-paper shadow-modal lg:max-w-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-cream-dark px-5 py-4 lg:px-6">
              <div>
                <p className="section-label">✨ Add a Moment</p>
                <h2 className="mt-1 font-serif text-xl font-semibold text-ink">
                  Capture what happened
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cream-dark bg-white/80 text-ink-muted transition-colors hover:text-ink"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 px-5 py-5 lg:px-6">
              <p className="text-sm leading-6 text-ink-soft">
                Something meaningful happened around{" "}
                <strong className="text-ink">{goalTitle}</strong>. Keep it
                honest and specific.
              </p>

              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What happened? What shifted? What did you notice?"
                className={cn(
                  "h-36 w-full resize-none rounded-2xl border bg-white/80 p-4 text-sm italic text-ink outline-none transition-all placeholder:text-ink-muted",
                  overLimit
                    ? "border-rose focus:border-rose"
                    : "border-cream-dark focus:border-ink-muted"
                )}
              />

              <div className="flex items-center justify-between text-xs">
                <span className={cn(overLimit ? "text-rose" : "text-ink-muted")}>
                  {wordCount} / {MAX_WORDS} words
                </span>
                {overLimit && <span className="text-rose">Keep it under 100 words.</span>}
              </div>

              {/* Perseverance toggle */}
              <button
                type="button"
                onClick={() => setIsPerseverance((v) => !v)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
                  isPerseverance
                    ? "border-gold/40 bg-gold/8 text-ink"
                    : "border-cream-dark bg-white/60 text-ink-muted hover:border-ink-muted/40 hover:text-ink"
                )}
              >
                <span className="text-xl">{isPerseverance ? "💪" : "🤍"}</span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", isPerseverance && "text-ink")}>
                    Moment of grit
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted leading-snug">
                    I didn&apos;t feel like doing it — but I showed up anyway
                  </p>
                </div>
                <div className={cn(
                  "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all",
                  isPerseverance
                    ? "border-gold bg-gold text-white"
                    : "border-ink-muted/40"
                )}>
                  {isPerseverance && (
                    <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  )}
                </div>
              </button>

              {/* Actions */}
              <div className="flex flex-col-reverse gap-3 pt-1 lg:flex-row lg:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary min-h-[44px] rounded-2xl px-5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || overLimit || !text.trim()}
                  className="btn-primary min-h-[44px] rounded-2xl px-5 disabled:opacity-40"
                >
                  {saving ? "Saving…" : isPerseverance ? "💪 Save Grit Moment" : "Save Moment"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
