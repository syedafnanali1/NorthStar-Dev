"use client";

// src/components/ai/decompose-modal.tsx
// Modal that lets a user describe a goal in plain language and have Claude
// parse it into a structured goal object ready to pre-fill the wizard.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Sparkles, Loader2, RotateCcw, Check } from "lucide-react";
import { cn } from "@/lib/utils/index";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DecomposedGoal {
  title: string;
  why?: string | null;
  category: "health" | "finance" | "writing" | "body" | "mindset" | "custom";
  targetValue: number | null;
  unit: string | null;
  suggestedMilestones: string[];
  suggestedTasks: string[];
  suggestedEndDate: string | null;
}

interface DecomposeModalProps {
  open: boolean;
  onClose: () => void;
  onAccept: (goal: DecomposedGoal) => void;
}

const CATEGORY_LABELS: Record<DecomposedGoal["category"], string> = {
  health: "Health & Fitness 🏃",
  finance: "Finance 💰",
  writing: "Writing & Creative ✍️",
  body: "Body Composition ⚖️",
  mindset: "Mindset & Learning 🧠",
  custom: "Custom ⭐",
};

// ─── Preview card ─────────────────────────────────────────────────────────────

function GoalPreviewCard({ goal }: { goal: DecomposedGoal }) {
  return (
    <div className="space-y-4 rounded-2xl border border-cream-dark bg-white/80 p-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
          {CATEGORY_LABELS[goal.category]}
        </p>
        <h3 className="mt-1.5 text-xl font-serif font-semibold text-ink">
          {goal.title}
        </h3>
        {goal.why ? (
          <p className="mt-1 text-sm italic text-ink-soft">&ldquo;{goal.why}&rdquo;</p>
        ) : null}
      </div>

      {(goal.targetValue !== null || goal.unit) ? (
        <div className="flex items-baseline gap-1.5">
          {goal.targetValue !== null ? (
            <span className="text-2xl font-semibold text-gold">
              {goal.targetValue.toLocaleString()}
            </span>
          ) : null}
          {goal.unit ? (
            <span className="text-sm text-ink-muted">{goal.unit}</span>
          ) : null}
          {goal.suggestedEndDate ? (
            <span className="ml-auto text-xs text-ink-muted">
              by{" "}
              {new Date(goal.suggestedEndDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          ) : null}
        </div>
      ) : null}

      {goal.suggestedMilestones.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
            Milestones
          </p>
          <div className="flex flex-wrap gap-2">
            {goal.suggestedMilestones.map((m) => (
              <span
                key={m}
                className="rounded-full border border-cream-dark bg-cream px-2.5 py-1 text-xs text-ink-soft"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {goal.suggestedTasks.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
            Daily Habits
          </p>
          <ul className="space-y-1.5">
            {goal.suggestedTasks.map((t) => (
              <li key={t} className="flex items-center gap-2 text-sm text-ink-soft">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold/70" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function DecomposeModal({ open, onClose, onAccept }: DecomposeModalProps) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DecomposedGoal | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDecompose() {
    if (!description.trim() || description.trim().length < 10) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ai/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim() }),
      });

      const data = (await res.json()) as
        | { goal: DecomposedGoal }
        | { error: string };

      if (!res.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Decomposition failed");
      }

      setResult(data.goal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleAccept() {
    if (!result) return;
    onAccept(result);
    handleClose();
  }

  function handleClose() {
    setDescription("");
    setResult(null);
    setError(null);
    setLoading(false);
    onClose();
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end bg-[rgba(26,23,20,0.56)] p-0 backdrop-blur-md lg:items-center lg:justify-center lg:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
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
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold/10">
                  <Sparkles className="h-4 w-4 text-gold" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
                    AI Coach
                  </p>
                  <h2 className="text-lg font-serif font-semibold text-ink">
                    Let AI Help You Define This
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-cream-dark bg-white/80 text-ink-muted transition hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-5 px-5 py-5 lg:px-6 lg:py-6">
              {!result ? (
                <>
                  <p className="text-sm leading-6 text-ink-soft">
                    Describe your goal in plain language. Claude will structure it
                    into a clear, measurable goal with milestones and daily habits.
                  </p>

                  <div className="space-y-2">
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder='e.g. "Save $20K for a house by Christmas" or "Run a half marathon in 6 months"'
                      maxLength={500}
                      rows={4}
                      className="form-input h-28 w-full resize-none rounded-2xl"
                      disabled={loading}
                    />
                    <div className="flex justify-between text-xs text-ink-muted">
                      <span>{description.length}/500</span>
                      {description.trim().length < 10 && description.length > 0 ? (
                        <span className="text-rose">Add more detail</span>
                      ) : null}
                    </div>
                  </div>

                  {error ? (
                    <p className="rounded-xl border border-rose/20 bg-rose/5 px-3 py-2 text-sm text-rose">
                      {error}
                    </p>
                  ) : null}

                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="btn-secondary min-h-[48px] rounded-2xl px-5"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDecompose}
                      disabled={loading || description.trim().length < 10}
                      className="btn-gold min-h-[48px] rounded-2xl px-5 disabled:opacity-40"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Thinking…
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Parse Goal
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-ink-soft">
                    Here&apos;s what Claude understood. Confirm to pre-fill the
                    goal form with this structure.
                  </p>

                  <GoalPreviewCard goal={result} />

                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setResult(null);
                        setError(null);
                      }}
                      className="btn-secondary flex items-center gap-2 min-h-[48px] rounded-2xl px-5"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Try Again
                    </button>
                    <button
                      type="button"
                      onClick={handleAccept}
                      className={cn(
                        "btn-gold min-h-[48px] rounded-2xl px-5"
                      )}
                    >
                      <Check className="h-4 w-4" />
                      Use This Goal
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
