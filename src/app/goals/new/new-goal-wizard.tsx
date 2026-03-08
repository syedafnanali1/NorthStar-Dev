// src/app/goals/new/new-goal-wizard.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createGoalSchema, type CreateGoalInput } from "@/lib/validators/goals";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toaster";

const CATEGORIES = [
  {
    value: "health" as const,
    label: "Health & Fitness",
    emoji: "🏃",
    hint: "km · miles · hours · reps",
    color: "#6B8C7A",
  },
  {
    value: "finance" as const,
    label: "Finance",
    emoji: "💰",
    hint: "$ saved · debt paid",
    color: "#5B7EA6",
  },
  {
    value: "writing" as const,
    label: "Writing & Creative",
    emoji: "✍️",
    hint: "words · pages · chapters",
    color: "#C4963A",
  },
  {
    value: "body" as const,
    label: "Body Composition",
    emoji: "⚖️",
    hint: "kg · lbs · body fat %",
    color: "#B5705B",
  },
  {
    value: "mindset" as const,
    label: "Mindset & Learning",
    emoji: "🧠",
    hint: "hours · sessions · books",
    color: "#7B6FA0",
  },
  {
    value: "custom" as const,
    label: "Custom",
    emoji: "⭐",
    hint: "Define your own unit",
    color: "#C4963A",
  },
];

const COLOR_OPTIONS = [
  "#C4963A", "#6B8C7A", "#B5705B", "#5B7EA6", "#7B6FA0",
  "#4A8562", "#8B4A6B", "#4A6B8B", "#8B6B4A", "#6B4A8B",
];

export function NewGoalWizard() {
  const [step, setStep] = useState(1);
  const [tasks, setTasks] = useState<string[]>([]);
  const [newTask, setNewTask] = useState("");
  const [milestoneInput, setMilestoneInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateGoalInput>({
    resolver: zodResolver(createGoalSchema),
    defaultValues: {
      color: "#C4963A",
      isPublic: false,
      milestones: [],
      tasks: [],
    },
  });

  const selectedCategory = watch("category");
  const selectedColor = watch("color");

  const addTask = () => {
    if (newTask.trim() && tasks.length < 10) {
      setTasks([...tasks, newTask.trim()]);
      setNewTask("");
    }
  };

  const removeTask = (i: number) => {
    setTasks(tasks.filter((_, idx) => idx !== i));
  };

  const onSubmit = async (data: CreateGoalInput) => {
    setSubmitting(true);
    try {
      const milestones = milestoneInput
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);

      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          milestones,
          tasks: tasks.map((text) => ({ text, isRepeating: true })),
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Failed to create goal");
      }

      toast("Goal created! ⭐");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create goal", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Progress steps */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              "flex-1 h-1 rounded-full transition-all",
              s < step ? "bg-gold" : s === step ? "bg-ink" : "bg-cream-dark"
            )}
          />
        ))}
      </div>

      {/* STEP 1: Category & basic info */}
      {step === 1 && (
        <div className="space-y-6 animate-fade-up">
          <div>
            <h2 className="text-xl font-serif font-semibold text-ink mb-1">
              What kind of goal is this?
            </h2>
            <p className="text-sm text-ink-muted">
              Each category uses a different metric to track daily progress.
            </p>
          </div>

          {/* Category grid */}
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => {
                    setValue("category", cat.value);
                    setValue("color", cat.color);
                  }}
                  className={cn(
                    "p-4 rounded-2xl border-[1.5px] text-left transition-all",
                    isSelected
                      ? "border-ink bg-ink text-cream-paper"
                      : "border-cream-dark bg-cream-paper text-ink hover:border-ink-muted"
                  )}
                >
                  <span className="text-2xl block mb-2">{cat.emoji}</span>
                  <span className={cn("block font-semibold text-sm", isSelected ? "text-cream-paper" : "text-ink")}>
                    {cat.label}
                  </span>
                  <span className={cn("text-xs", isSelected ? "text-cream-paper/50" : "text-ink-muted")}>
                    {cat.hint}
                  </span>
                </button>
              );
            })}
          </div>
          {errors.category && (
            <p className="text-xs text-rose">{errors.category.message}</p>
          )}

          {/* Goal title */}
          <div className="form-group">
            <label className="form-label">The Goal</label>
            <input
              {...register("title")}
              placeholder="e.g. Run a marathon"
              className={cn("form-input", errors.title && "border-rose")}
            />
            {errors.title && (
              <p className="text-xs text-rose mt-1">{errors.title.message}</p>
            )}
          </div>

          {/* Why */}
          <div className="form-group">
            <label className="form-label">Your Why — the emotional anchor</label>
            <textarea
              {...register("why")}
              placeholder="Why does this matter to you?"
              className="form-input resize-none h-20 font-serif italic"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!selectedCategory) {
                  toast("Please select a category", "error");
                  return;
                }
                const title = watch("title");
                if (!title || title.length < 3) {
                  toast("Please enter a goal title", "error");
                  return;
                }
                setStep(2);
              }}
              className="btn-primary"
            >
              Next: Measure it →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Metrics & timeframe */}
      {step === 2 && (
        <div className="space-y-6 animate-fade-up">
          <div>
            <h2 className="text-xl font-serif font-semibold text-ink mb-1">
              Define Your Progress
            </h2>
            <p className="text-sm text-ink-muted">
              Set a measurable target and optional timeframe.
            </p>
          </div>

          {/* Target + Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Target Amount</label>
              <input
                {...register("targetValue")}
                type="number"
                min="0"
                placeholder="e.g. 42.2"
                className={cn("form-input", errors.targetValue && "border-rose")}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Unit</label>
              <input
                {...register("unit")}
                placeholder="e.g. km"
                className="form-input"
              />
            </div>
          </div>

          {/* Current value */}
          <div className="form-group">
            <label className="form-label">Starting Point (current progress)</label>
            <input
              {...register("currentValue")}
              type="number"
              min="0"
              placeholder="0"
              className="form-input"
            />
          </div>

          {/* Timeframe */}
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input {...register("startDate")} type="date" className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input {...register("endDate")} type="date" className="form-input" />
            </div>
          </div>

          {/* Milestones */}
          <div className="form-group">
            <label className="form-label">
              Milestones (comma-separated)
            </label>
            <input
              value={milestoneInput}
              onChange={(e) => setMilestoneInput(e.target.value)}
              placeholder="e.g. 5K, 10K, Half Marathon, Race Day"
              className="form-input"
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="form-label">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setValue("color", color)}
                  className={cn(
                    "w-7 h-7 rounded-full border-2 transition-transform",
                    selectedColor === color
                      ? "border-ink scale-110"
                      : "border-transparent hover:scale-105"
                  )}
                  style={{ background: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-between gap-3 pt-2">
            <button type="button" onClick={() => setStep(1)} className="btn-secondary">
              ← Back
            </button>
            <button type="button" onClick={() => setStep(3)} className="btn-primary">
              Next: Add Tasks →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Daily tasks */}
      {step === 3 && (
        <div className="space-y-6 animate-fade-up">
          <div>
            <h2 className="text-xl font-serif font-semibold text-ink mb-1">
              Linked Daily Intentions
            </h2>
            <p className="text-sm text-ink-muted">
              These tasks auto-appear on your calendar every day within this
              goal&apos;s timeframe.
            </p>
          </div>

          {/* Task list */}
          <div className="space-y-2">
            {tasks.map((task, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border-[1.5px] border-cream-dark bg-cream-paper"
              >
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: selectedColor ?? "#C4963A" }}
                />
                <span className="flex-1 text-sm text-ink">{task}</span>
                <button
                  type="button"
                  onClick={() => removeTask(i)}
                  className="text-ink-muted hover:text-rose transition-colors text-base leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Add task input */}
          <div className="flex gap-2">
            <input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTask())}
              placeholder="e.g. Run 5km"
              className="form-input flex-1"
            />
            <button
              type="button"
              onClick={addTask}
              disabled={!newTask.trim() || tasks.length >= 10}
              className="btn-secondary px-4 disabled:opacity-40"
            >
              + Add
            </button>
          </div>

          <p className="text-xs text-ink-muted italic">
            💡 These repeating tasks will appear under your calendar&apos;s
            &ldquo;Today&apos;s Intentions&rdquo; every day within your
            goal&apos;s timeframe.
          </p>

          <div className="flex justify-between gap-3 pt-2">
            <button type="button" onClick={() => setStep(2)} className="btn-secondary">
              ← Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-gold disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Plant this Star ⭐"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
