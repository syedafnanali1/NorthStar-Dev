// src/lib/validators/profile.ts
import { z } from "zod";

export const sendInvitationSchema = z.object({
  email: z.string().email("Please enter a valid email address").optional(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{7,14}$/, "Please enter a valid phone number")
    .optional(),
  goalIds: z.array(z.string()).max(5, "Maximum 5 goals").optional().default([]),
}).refine(
  (data) => data.email || data.phone,
  "Either email or phone number is required"
);

export type SendInvitationInput = z.infer<typeof sendInvitationSchema>;

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be under 50 characters")
    .optional(),
  email: z.string().email("Please enter a valid email address").optional(),
  age: z.coerce
    .number()
    .int()
    .min(13, "Must be at least 13 years old")
    .max(120, "Please enter a valid age")
    .optional()
    .nullable(),
  location: z.string().max(100, "Location must be under 100 characters").optional().nullable(),
  bio: z.string().max(500, "Bio must be under 500 characters").optional().nullable(),
  darkMode: z.boolean().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
