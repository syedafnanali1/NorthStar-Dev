// src/lib/env.ts
// Runtime validation of ALL environment variables using Zod
// Import from here instead of process.env directly

import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),

  // Auth
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  NEXTAUTH_URL: z.string().url().optional(),

  // Google OAuth (optional — app works without it, Google sign-in is disabled when missing)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Facebook OAuth (optional — app works without it, Facebook sign-in is disabled when missing)
  FACEBOOK_CLIENT_ID: z.string().optional(),
  FACEBOOK_CLIENT_SECRET: z.string().optional(),

  // Email (optional — email sign-up disabled when missing; use Google sign-in instead)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // SMS (optional - app works without it but invite by SMS is disabled)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // AI (optional — AI coaching features disabled when missing)
  ANTHROPIC_API_KEY: z.string().optional(),

  // Security (optional — falls back to AUTH_SECRET when missing)
  AUTH_SECURITY_SECRET: z.string().optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL").optional(),
  NEXT_PUBLIC_APP_NAME: z.string().default("North Star"),

  // Cron jobs
  CRON_SECRET: z.string().optional(),

  // File uploads (optional)
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // Node environment
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const errors = parsed.error.errors
      .map((e) => `  ✗ ${e.path.join(".")}: ${e.message}`)
      .join("\n");

    throw new Error(
      `\n❌ Environment validation failed:\n${errors}\n\n` +
        `Please check your .env.local file.\n` +
        `See .env.example for all required variables.\n`
    );
  }

  return parsed.data;
}

// Validate once on import — this runs at server startup
// This means misconfigured environments fail loudly at boot, not at runtime
export const env = validateEnv();
