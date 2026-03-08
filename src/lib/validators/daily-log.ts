// src/lib/validators/daily-log.ts

import { z } from "zod";

export const saveDailyLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  mood: z
    .enum(["energized", "good", "neutral", "tired", "low", "focused", "anxious"])
    .optional()
    .nullable(),
  sleep: z
    .enum(["under_5", "five_to_6", "six_to_7", "seven_to_8", "over_8"])
    .optional()
    .nullable(),
  reflection: z
    .string()
    .max(2000, "Reflection must be under 2000 characters")
    .optional()
    .nullable(),
  completedTaskIds: z.array(z.string()).default([]),
});

export type SaveDailyLogInput = z.infer<typeof saveDailyLogSchema>;
