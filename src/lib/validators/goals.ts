// src/lib/validators/goals.ts

import { z } from "zod";

export const goalCategorySchema = z.enum([
  "health",
  "finance",
  "writing",
  "body",
  "mindset",
  "custom",
]);

export const createGoalSchema = z.object({
  title: z
    .string()
    .min(3, "Goal title must be at least 3 characters")
    .max(120, "Goal title must be under 120 characters"),
  why: z
    .string()
    .max(500, "Why statement must be under 500 characters")
    .optional(),
  category: goalCategorySchema,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").optional(),
  // Metric
  targetValue: z.coerce
    .number()
    .positive("Target must be a positive number")
    .optional(),
  currentValue: z.coerce.number().min(0, "Starting value cannot be negative").optional(),
  unit: z.string().max(20, "Unit must be under 20 characters").optional(),
  // Milestones
  milestones: z
    .array(z.string().max(50))
    .max(10, "Maximum 10 milestones")
    .optional()
    .default([]),
  // Timeframe
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  // Visibility
  isPublic: z.boolean().optional().default(false),
  // Emoji
  emoji: z.string().max(4).optional(),
  // Daily tasks
  tasks: z
    .array(
      z.object({
        text: z.string().min(1).max(200),
        isRepeating: z.boolean().default(true),
      })
    )
    .max(10, "Maximum 10 daily tasks")
    .optional()
    .default([]),
});

export const updateGoalSchema = createGoalSchema.partial().omit({ tasks: true });

export const logProgressSchema = z.object({
  value: z.coerce
    .number()
    .positive("Progress value must be positive")
    .max(1_000_000, "Value is too large"),
  note: z.string().max(500, "Note must be under 500 characters").optional(),
});

export const createMomentSchema = z.object({
  text: z
    .string()
    .min(1, "Moment text cannot be empty")
    .max(1000, "Moment must be under 1000 characters"),
  visibility: z.enum(["private", "circle", "public"]).default("circle"),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type LogProgressInput = z.infer<typeof logProgressSchema>;
export type CreateMomentInput = z.infer<typeof createMomentSchema>;
