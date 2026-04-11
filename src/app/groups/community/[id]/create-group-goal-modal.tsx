"use client";

// src/app/groups/community/[id]/create-group-goal-modal.tsx
// Two-mode goal creation: AI-generated suggestion or manual form.
// Rendered inside a bottom sheet / modal overlay.

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Sparkles, PenLine, Plus, Minus, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils/index";
import { toast } from "@/components/ui/toaster";
import type { AiGoalSuggestion, TrackingFrequency, GoalCategory } from "@/server/services/group-goal-items.service";

type Mode = "choose" | "ai" | "manual";

const CATEGORIES: { value: GoalCategory; label: string; emoji: string }[] = [
  { value: "health", label: "Health", emoji: "🏃" },
  { value: "finance", label: "Finance", emoji: "💰" },
  { value: "writing", label: "Writing", emoji: "✍️" },
  { value: "body", label: "Body", emoji: "💪" },
  { value: "mindset", label: "Mindset", emoji: "🧠" },
  { value: "custom", label: "Custom", emoji: "⭐" },
];

const FREQUENCIES: { value: TrackingFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
];

interface FormState {
  title: string;
  description: string;
  category: GoalCategory;
  trackingFrequency: TrackingFrequency;
  customFrequencyLabel: string;
  milestones: string[];
  emoji: string;
  unit: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  category: "custom",
  trackingFrequency: "weekly",
  customFrequencyLabel: "",
  milestones: [""],
  emoji: "⭐",
  unit: "",
};

interface CreateGroupGoalModalProps {
  groupId: string;
  onClose: () => void;
}

export function CreateGroupGoalModal({ groupId, onClose }: CreateGroupGoalModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");

  // AI state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiGoalSuggestion | null>(null);

  // Form state (shared between AI-prefilled and manual)
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  function patchForm(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  // ── AI suggestion ────────────────────────────────────────────────────────────

  async function handleAiSuggest() {
    if (aiPrompt.trim().length < 10) {
      toast("Please describe what your group wants to achieve (at least 10 characters).", "error");
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/goals/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiPrompt }),
      });
      if (!res.ok) throw new Error("Failed to generate suggestion");
      const data = (await res.json()) as { suggestion: AiGoalSuggestion };
      setAiSuggestion(data.suggestion);
      // Pre-fill form with suggestion
      setForm({
        title: data.suggestion.title,
        description: data.suggestion.description,
        category: data.suggestion.category,
        trackingFrequency: data.suggestion.trackingFrequency,
        customFrequencyLabel: "",
        milestones: data.suggestion.milestones.length > 0
          ? data.suggestion.milestones
          : [""],
        emoji: data.suggestion.emoji,
        unit: "",
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to generate suggestion", "error");
    } finally {
      setAiLoading(false);
    }
  }

  function handleAcceptSuggestion() {
    setMode("manual"); // Transition to edit the prefilled form
    setAiSuggestion(null);
  }

  // ── Milestone helpers ────────────────────────────────────────────────────────

  function updateMilestone(i: number, value: string) {
    const next = [...form.milestones];
    next[i] = value;
    patchForm({ milestones: next });
  }

  function addMilestone() {
    if (form.milestones.length >= 8) return;
    patchForm({ milestones: [...form.milestones, ""] });
  }

  function removeMilestone(i: number) {
    const next = form.milestones.filter((_, idx) => idx !== i);
    patchForm({ milestones: next.length > 0 ? next : [""] });
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!form.title.trim()) {
      toast("Goal title is required.", "error");
      return;
    }
    if (form.trackingFrequency === "custom" && !form.customFrequencyLabel.trim()) {
      toast("Enter a label for your custom frequency (e.g. \"Every 3 days\").", "error");
      return;
    }

    setSubmitting(true);
    try {
      const milestones = form.milestones.map((m) => m.trim()).filter(Boolean);
      const res = await fetch(`/api/groups/${groupId}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          category: form.category,
          trackingFrequency: form.trackingFrequency,
          customFrequencyLabel: form.customFrequencyLabel.trim() || undefined,
          milestones,
          emoji: form.emoji || undefined,
          unit: form.unit.trim() || undefined,
          createdVia: aiSuggestion !== null || mode === "ai" ? "ai" : "manual",
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to create goal");
      }

      toast("Group goal created!", "success");
      router.refresh();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create goal", "error");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl border border-cream-dark bg-cream-paper shadow-modal">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-cream-dark bg-cream-paper px-5 py-4">
          <div>
            <h2 className="font-serif text-lg font-semibold text-ink">
              {mode === "choose" ? "Create a Group Goal" : mode === "ai" ? "AI Goal Assistant" : "Goal Details"}
            </h2>
            <p className="text-xs text-ink-muted">
              {mode === "choose" ? "Choose how you'd like to create your goal." :
               mode === "ai" ? "Describe what your group wants to achieve." :
               "Review and adjust the goal before saving."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-ink-muted transition hover:bg-cream-dark hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* ── Mode chooser ── */}
          {mode === "choose" && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode("ai")}
                className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-cream-dark bg-cream p-5 text-center transition hover:border-gold/50 hover:bg-gold/5"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-2xl">
                  <Sparkles className="h-6 w-6 text-violet-500" />
                </div>
                <div>
                  <p className="font-semibold text-ink">AI-Generated</p>
                  <p className="mt-0.5 text-xs text-ink-muted">Describe your goal; AI structures it</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setMode("manual"); setForm(EMPTY_FORM); }}
                className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-cream-dark bg-cream p-5 text-center transition hover:border-ink/30 hover:bg-cream-dark/50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-dark text-2xl">
                  <PenLine className="h-6 w-6 text-ink" />
                </div>
                <div>
                  <p className="font-semibold text-ink">Manual</p>
                  <p className="mt-0.5 text-xs text-ink-muted">Fill in title, milestones yourself</p>
                </div>
              </button>
            </div>
          )}

          {/* ── AI mode: prompt + suggestion ── */}
          {mode === "ai" && (
            <div className="space-y-4">
              <div>
                <label className="form-label" htmlFor="ai-prompt">
                  What does your group want to achieve?
                </label>
                <textarea
                  id="ai-prompt"
                  rows={3}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Run a 5K together by end of summer, or read 12 books this year as a group…"
                  className="form-input mt-1 resize-none"
                  maxLength={500}
                />
                <p className="mt-1 text-right text-[0.65rem] text-ink-muted">
                  {aiPrompt.length}/500
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleAiSuggest()}
                disabled={aiLoading || aiPrompt.trim().length < 10}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3 text-sm font-semibold text-cream-paper transition hover:opacity-90 disabled:opacity-40"
              >
                {aiLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Thinking…</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Generate Goal</>
                )}
              </button>

              {/* AI suggestion card */}
              {aiSuggestion && (
                <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="text-2xl">{aiSuggestion.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{aiSuggestion.title}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">{aiSuggestion.description}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[0.6rem] font-bold text-violet-600">
                      ✦ AI
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-cream-dark px-2.5 py-0.5 text-xs text-ink-muted capitalize">
                      {aiSuggestion.category}
                    </span>
                    <span className="rounded-full bg-cream-dark px-2.5 py-0.5 text-xs text-ink-muted capitalize">
                      {aiSuggestion.trackingFrequency}
                    </span>
                  </div>

                  {aiSuggestion.milestones.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {aiSuggestion.milestones.map((m, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-full bg-white/60 px-2.5 py-1 text-xs text-ink-muted border border-violet-100"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleAcceptSuggestion}
                      className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-cream-paper transition hover:opacity-90"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Use this goal
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleAiSuggest()}
                      disabled={aiLoading}
                      className="rounded-full border border-cream-dark px-4 py-2 text-xs font-medium text-ink-muted transition hover:text-ink disabled:opacity-40"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setMode("choose")}
                className="text-xs text-ink-muted hover:text-ink"
              >
                ← Back
              </button>
            </div>
          )}

          {/* ── Manual / edit form ── */}
          {mode === "manual" && (
            <div className="space-y-4">
              {/* Emoji + Title */}
              <div className="flex gap-2">
                <div className="shrink-0">
                  <label className="form-label" htmlFor="goal-emoji">Emoji</label>
                  <input
                    id="goal-emoji"
                    type="text"
                    maxLength={4}
                    value={form.emoji}
                    onChange={(e) => patchForm({ emoji: e.target.value })}
                    className="form-input mt-1 w-16 text-center text-xl"
                    placeholder="⭐"
                  />
                </div>
                <div className="flex-1">
                  <label className="form-label" htmlFor="goal-title">
                    Goal title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="goal-title"
                    type="text"
                    maxLength={120}
                    value={form.title}
                    onChange={(e) => patchForm({ title: e.target.value })}
                    placeholder="e.g. Run a 5K as a team"
                    className="form-input mt-1"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="form-label" htmlFor="goal-desc">Description</label>
                <textarea
                  id="goal-desc"
                  rows={2}
                  maxLength={400}
                  value={form.description}
                  onChange={(e) => patchForm({ description: e.target.value })}
                  placeholder="Brief description for group members…"
                  className="form-input mt-1 resize-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="form-label">Category</label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => patchForm({ category: cat.value })}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        form.category === cat.value
                          ? "border-ink bg-ink text-cream-paper"
                          : "border-cream-dark bg-cream text-ink-muted hover:border-ink/30 hover:text-ink"
                      )}
                    >
                      {cat.emoji} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tracking frequency */}
              <div>
                <label className="form-label">Tracking frequency</label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {FREQUENCIES.map((freq) => (
                    <button
                      key={freq.value}
                      type="button"
                      onClick={() => patchForm({ trackingFrequency: freq.value })}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        form.trackingFrequency === freq.value
                          ? "border-gold bg-gold/10 text-gold"
                          : "border-cream-dark bg-cream text-ink-muted hover:border-gold/40"
                      )}
                    >
                      {freq.label}
                    </button>
                  ))}
                </div>
                {form.trackingFrequency === "custom" && (
                  <input
                    type="text"
                    maxLength={40}
                    value={form.customFrequencyLabel}
                    onChange={(e) => patchForm({ customFrequencyLabel: e.target.value })}
                    placeholder='e.g. "Every 3 days"'
                    className="form-input mt-2"
                  />
                )}
              </div>

              {/* Unit (optional) */}
              <div>
                <label className="form-label" htmlFor="goal-unit">
                  Unit <span className="text-ink-muted">(optional, e.g. km, pages, ₂)</span>
                </label>
                <input
                  id="goal-unit"
                  type="text"
                  maxLength={20}
                  value={form.unit}
                  onChange={(e) => patchForm({ unit: e.target.value })}
                  placeholder="e.g. km"
                  className="form-input mt-1 w-36"
                />
              </div>

              {/* Milestones */}
              <div>
                <label className="form-label">
                  Milestones <span className="text-ink-muted">(optional, max 8)</span>
                </label>
                <div className="mt-1.5 space-y-2">
                  {form.milestones.map((m, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        maxLength={120}
                        value={m}
                        onChange={(e) => updateMilestone(i, e.target.value)}
                        placeholder={`Milestone ${i + 1}…`}
                        className="form-input flex-1 py-1.5 text-sm"
                      />
                      {form.milestones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMilestone(i)}
                          className="shrink-0 rounded-lg p-2 text-ink-muted hover:bg-cream-dark hover:text-rose-600"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {form.milestones.length < 8 && (
                    <button
                      type="button"
                      onClick={addMilestone}
                      className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add milestone
                    </button>
                  )}
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={submitting || !form.title.trim()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-ink py-3 text-sm font-semibold text-cream-paper transition hover:opacity-90 disabled:opacity-40"
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                  ) : (
                    "Create goal"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("choose")}
                  className="rounded-2xl border border-cream-dark px-4 py-3 text-sm text-ink-muted transition hover:text-ink"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
