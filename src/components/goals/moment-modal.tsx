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

export function MomentModal({
  goalId,
  goalTitle,
  open,
  onClose,
}: MomentModalProps) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wordCount = countWords(text);
  const overLimit = wordCount > MAX_WORDS;

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeout = window.setTimeout(() => textareaRef.current?.focus(), 160);
    return () => window.clearTimeout(timeout);
  }, [open]);

  const handleSave = async () => {
    if (!text.trim() || overLimit || saving) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/goals/${goalId}/moments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), visibility: "circle" }),
      });

      if (!response.ok) {
        throw new Error("Failed to save moment");
      }

      toast("Moment saved ✓");
      setText("");
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
          className="fixed inset-0 z-[70] flex items-end bg-[rgba(26,23,20,0.56)] p-0 backdrop-blur-md lg:items-center lg:justify-center lg:p-4"
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
            className="mobile-sheet w-full bg-cream-paper shadow-modal lg:max-w-xl"
          >
            <div className="flex items-center justify-between border-b border-cream-dark px-5 py-4 lg:px-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
                  Add a Moment
                </p>
                <h2 className="mt-2 text-2xl font-serif font-semibold text-ink">
                  Add a Moment
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

            <div className="space-y-5 px-5 py-5 lg:px-6 lg:py-6">
              <p className="text-sm leading-6 text-ink-soft">
                Capture what happened around <strong>{goalTitle}</strong>. Keep it short,
                honest, and specific.
              </p>

              <textarea
                ref={textareaRef}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="What happened today? What shifted?"
                className={cn(
                  "h-44 w-full resize-none rounded-[1.5rem] border bg-white/80 p-4 text-sm italic text-ink outline-none transition-all placeholder:text-ink-muted",
                  overLimit
                    ? "border-rose focus:border-rose"
                    : "border-cream-dark focus:border-ink-muted"
                )}
              />

              <div className="flex items-center justify-between text-xs">
                <span className={cn(overLimit ? "text-rose" : "text-ink-muted")}>
                  {wordCount} / {MAX_WORDS} words
                </span>
                {overLimit ? <span className="text-rose">Keep it under 100 words.</span> : null}
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
                  onClick={handleSave}
                  disabled={saving || overLimit || !text.trim()}
                  className="btn-primary min-h-[48px] rounded-2xl px-5 disabled:opacity-40"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
