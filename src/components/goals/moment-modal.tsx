// src/components/goals/moment-modal.tsx
"use client";

import { useState, useRef, useEffect } from "react";
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
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wordCount = countWords(text);
  const overLimit = wordCount > MAX_WORDS;

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSave = async () => {
    if (!text.trim() || overLimit || saving) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/goals/${goalId}/moments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), visibility: "circle" }),
      });

      if (!res.ok) throw new Error();

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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(26,23,20,0.6)", backdropFilter: "blur(6px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-3xl p-8 animate-slide-in"
        style={{ background: "var(--cream-paper)", boxShadow: "0 24px 64px rgba(26,23,20,0.18)" }}
      >
        <h2 className="text-2xl font-serif font-semibold text-ink mb-1">
          📝 Add a Moment
        </h2>
        <p className="text-sm text-ink-muted mb-6">
          Capture a reflection for <strong>{goalTitle}</strong>.
          What happened? How did it feel?
        </p>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your reflection..."
          className={cn(
            "w-full h-32 resize-none p-4 rounded-xl border-[1.5px] bg-cream font-serif italic",
            "text-sm text-ink placeholder:text-ink-muted outline-none",
            "transition-all",
            overLimit
              ? "border-rose focus:border-rose"
              : "border-cream-dark focus:border-ink"
          )}
        />

        <div className="flex items-center justify-between mt-2 mb-6">
          <span
            className={cn(
              "text-xs font-mono",
              overLimit ? "text-rose" : "text-ink-muted"
            )}
          >
            {wordCount} / {MAX_WORDS} words
          </span>
          {overLimit && (
            <span className="text-xs text-rose">Too long</span>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || overLimit || !text.trim()}
            className="btn-primary flex-1 disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save Moment ✓"}
          </button>
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
