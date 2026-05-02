"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, Clock, Plus, RotateCw, Trash2, X, CalendarPlus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

interface Intention {
  id: string;
  title: string;
  scheduledAt: string | null;
  recurrence: "none" | "daily" | "weekly" | "monthly" | "custom";
  notes: string | null;
  isDefault: boolean;
}

interface GoalIntentionsSheetProps {
  goalId: string;
  goalTitle: string;
  onClose: () => void;
}

const RECURRENCE_LABELS: Record<string, string> = {
  none: "One-time",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  custom: "Custom",
};

const QUICK_TITLES = [
  "Morning check-in",
  "Evening review",
  "Weekly progress review",
  "Deep work session",
  "I was here",
];

export function GoalIntentionsSheet({ goalId, goalTitle, onClose }: GoalIntentionsSheetProps) {
  const [intentions, setIntentions] = useState<Intention[]>([]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  // New intention form state
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [recurrence, setRecurrence] = useState<Intention["recurrence"]>("none");
  const [notes, setNotes] = useState("");

  async function addIntention() {
    const trimmed = title.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/goals/${goalId}/intentions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmed,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          recurrence,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { intention: Intention };
      setIntentions((prev) => [data.intention, ...prev]);
      setTitle("");
      setScheduledAt("");
      setRecurrence("none");
      setNotes("");
      setAdding(false);
    } catch {
      toast("Couldn't save intention — try again");
    } finally {
      setSaving(false);
    }
  }

  async function removeIntention(id: string) {
    const intentionId = intentions.find((i) => i.id === id)?.id;
    if (!intentionId) return;
    setIntentions((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/goals/${goalId}/intentions/${intentionId}`, { method: "DELETE" });
  }

  function calendarUrl(intention: Intention) {
    const title = encodeURIComponent(intention.title);
    const details = encodeURIComponent(intention.notes ?? `Intention for: ${goalTitle}`);
    const date = intention.scheduledAt ? new Date(intention.scheduledAt) : new Date();
    const start = date.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
    const end = new Date(date.getTime() + 3600000).toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
    return `https://calendar.google.com/calendar/r/eventedit?text=${title}&dates=${start}/${end}&details=${details}`;
  }

  function icsDownload(intention: Intention) {
    const start = intention.scheduledAt ? new Date(intention.scheduledAt) : new Date();
    const end = new Date(start.getTime() + 3600000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NorthStar//EN",
      "BEGIN:VEVENT",
      `UID:${intention.id}@northstar`,
      `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
      `SUMMARY:${intention.title}`,
      intention.notes ? `DESCRIPTION:${intention.notes}` : "",
      "END:VEVENT", "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${intention.title.replace(/\s+/g, "_")}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="relative w-full max-w-lg bg-[var(--color-card)] rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--color-border)]">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-fg)]">Add Intentions</h2>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              Schedule time to work on &ldquo;{goalTitle}&rdquo;
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-muted)]">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* Existing intentions */}
          <AnimatePresence initial={false}>
            {intentions.map((intention) => (
              <motion.div
                key={intention.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-3 p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]"
              >
                <Calendar size={15} className="mt-0.5 text-[var(--color-accent)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-fg)] truncate">{intention.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {intention.scheduledAt && (
                      <span className="text-xs text-[var(--color-muted)] flex items-center gap-1">
                        <Clock size={11} />
                        {format(new Date(intention.scheduledAt), "MMM d, h:mm a")}
                      </span>
                    )}
                    {intention.recurrence !== "none" && (
                      <span className="text-xs text-[var(--color-accent)] flex items-center gap-1">
                        <RotateCw size={11} />
                        {RECURRENCE_LABELS[intention.recurrence]}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a href={calendarUrl(intention)} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 rounded hover:bg-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-accent)]">
                    <CalendarPlus size={14} />
                  </a>
                  <button onClick={() => icsDownload(intention)}
                    className="p-1.5 rounded hover:bg-[var(--color-border)] text-[var(--color-muted)] text-xs font-mono">
                    .ics
                  </button>
                  <button onClick={() => void removeIntention(intention.id)}
                    className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-[var(--color-muted)] hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Add intention form */}
          <AnimatePresence>
            {adding ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 p-3 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5"
              >
                {/* Quick title suggestions */}
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_TITLES.map((qt) => (
                    <button key={qt} onClick={() => setTitle(qt)}
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-full border transition-colors",
                        title === qt
                          ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                          : "border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]"
                      )}>
                      {qt}
                    </button>
                  ))}
                </div>

                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Intention title…"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-[var(--color-muted)] mb-1 block">Date & Time</label>
                    <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)]" />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-muted)] mb-1 block">Repeat</label>
                    <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Intention["recurrence"])}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)]">
                      {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <input value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional note…"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)]" />

                <div className="flex gap-2">
                  <button onClick={() => setAdding(false)}
                    className="flex-1 py-1.5 text-sm rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface)]">
                    Cancel
                  </button>
                  <button onClick={() => void addIntention()} disabled={!title.trim() || saving}
                    className="flex-1 py-1.5 text-sm rounded-lg bg-[var(--color-accent)] text-white font-medium disabled:opacity-50">
                    {saving ? "Saving…" : "Add"}
                  </button>
                </div>
              </motion.div>
            ) : (
              <button onClick={() => setAdding(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[var(--color-border)] text-sm text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors">
                <Plus size={15} />
                Add intention
              </button>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[var(--color-border)] flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-surface)]">
            {intentions.length === 0 ? "Skip for now" : "Done"}
          </button>
          {intentions.length > 0 && (
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[var(--color-accent)] text-white text-sm font-medium">
              Save {intentions.length} intention{intentions.length !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
