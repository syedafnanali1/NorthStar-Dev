"use client";

// src/components/group-goals/group-task-board.tsx

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { cn, initials } from "@/lib/utils";
import type { GroupTask } from "@/server/services/group-goals.service";

interface GroupTaskBoardProps {
  groupGoalId: string;
  canInteract: boolean;
  initialTasks: GroupTask[];
}

export function GroupTaskBoard({ groupGoalId, canInteract, initialTasks }: GroupTaskBoardProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  async function addTask() {
    const text = draft.trim();
    if (!text || busy || !canInteract) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/group-goals/${groupGoalId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to add task");
      }
      const data = (await res.json()) as { tasks: GroupTask[] };
      setTasks(data.tasks);
      setDraft("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to add task", "error");
    } finally {
      setBusy(false);
    }
  }

  async function completeTask(taskId: string) {
    if (busy || !canInteract) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/group-goals/${groupGoalId}/tasks/${taskId}/complete`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to complete task");
      }
      const data = (await res.json()) as { tasks: GroupTask[] };
      setTasks(data.tasks);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to complete task", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="section-label">Shared Tasks</p>

      {/* Add task input */}
      {canInteract && (
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addTask();
              }
            }}
            placeholder="Add a shared action item…"
            className="form-input h-10 flex-1"
            maxLength={220}
            disabled={busy}
          />
          <button
            type="button"
            onClick={() => void addTask()}
            disabled={busy || !draft.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-cream-paper transition hover:opacity-90 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-cream-dark px-5 py-8 text-center text-sm italic text-ink-muted">
          No shared tasks yet.{canInteract ? " Add one above!" : ""}
        </p>
      ) : (
        <div className="space-y-4">
          {/* Open tasks */}
          {open.length > 0 && (
            <div className="space-y-2">
              {open.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onComplete={() => void completeTask(task.id)}
                  busy={busy}
                  canInteract={canInteract}
                />
              ))}
            </div>
          )}

          {/* Completed */}
          {done.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-ink-muted">
                Completed ({done.length})
              </p>
              <div className="space-y-2">
                {done.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onComplete={() => void completeTask(task.id)}
                    busy={busy}
                    canInteract={canInteract}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  onComplete,
  busy,
  canInteract,
}: {
  task: GroupTask;
  onComplete: () => void;
  busy: boolean;
  canInteract: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3 transition-all",
        task.completed ? "border-cream-dark bg-cream/50 opacity-70" : "border-cream-dark bg-cream-paper"
      )}
    >
      <button
        type="button"
        onClick={onComplete}
        disabled={busy || task.completed || !canInteract}
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all",
          task.completed
            ? "border-gold bg-gold text-ink"
            : "border-ink-muted bg-cream-paper text-transparent hover:border-ink"
        )}
        aria-label="Mark task complete"
      >
        <Check className="h-3 w-3" />
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn("text-sm text-ink", task.completed && "line-through opacity-60")}>
          {task.text}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gold/20 text-[8px] font-bold text-ink">
              {initials(task.createdBy.name)}
            </span>
            {task.createdBy.username ? `@${task.createdBy.username}` : (task.createdBy.name ?? "member")}
          </span>
          {task.completed && task.completedBy ? (
            <span className="text-gold">✓ {task.completedBy.name ?? "member"}</span>
          ) : (
            <span>open</span>
          )}
        </div>
      </div>
    </div>
  );
}
