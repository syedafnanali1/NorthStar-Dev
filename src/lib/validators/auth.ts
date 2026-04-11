import { z } from "zod";

const passwordComplexity = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/;
const e164Phone = /^\+[1-9]\d{7,14}$/;
const usernamePattern = /^[a-zA-Z0-9_]{3,30}$/;

function isAtLeast13(dateOfBirthRaw: string): boolean {
  const date = new Date(dateOfBirthRaw);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  const threshold = new Date(
    now.getFullYear() - 13,
    now.getMonth(),
    now.getDate()
  );

  return date <= threshold;
}

function hasValidFirstAndLastName(value: string): boolean {
  const normalized = value.trim().replace(/\s+/g, " ");
  const parts = normalized.split(" ");
  if (parts.length < 2) return false;

  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ");
  return first.length >= 2 && last.length >= 2;
}

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(5, "Please enter your full name")
      .max(80, "Name must be under 80 characters")
      .refine(
        (value) => hasValidFirstAndLastName(value),
        "Enter first and last name (minimum 2 characters each)"
      ),
    email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
    phoneNumber: z
      .string()
      .trim()
      .regex(e164Phone, "Use a valid phone number in E.164 format (e.g., +14155552671)"),
    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .regex(
        passwordComplexity,
        "Password must include uppercase, lowercase, number, and symbol"
      ),
    confirmPassword: z.string(),
    dateOfBirth: z
      .string()
      .min(1, "Date of birth is required")
      .refine((value) => isAtLeast13(value), "You must be at least 13 years old to register"),
    countryRegion: z
      .string()
      .trim()
      .min(2, "Country / Region is required")
      .max(64, "Country / Region is too long"),
    username: z
      .string()
      .trim()
      .max(30, "Username must be 30 characters or less")
      .optional()
      .or(z.literal(""))
      .refine(
        (value) => !value || usernamePattern.test(value),
        "Username can only contain letters, numbers, and underscore"
      ),
    profilePhotoDataUrl: z
      .string()
      .optional()
      .refine(
        (value) => {
          if (!value) return true;
          const okMime = value.startsWith("data:image/jpeg") || value.startsWith("data:image/png") || value.startsWith("data:image/webp");
          if (!okMime) return false;
          return value.length <= 7_000_000;
        },
        "Profile photo must be JPEG/PNG/WEBP and under 5MB"
      ),
    referralCode: z.string().trim().max(64, "Referral code is too long").optional().or(z.literal("")),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token is required"),
    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .regex(
        passwordComplexity,
        "Password must include uppercase, lowercase, number, and symbol"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
