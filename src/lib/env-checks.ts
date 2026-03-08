// src/lib/env-checks.ts
// Utility helpers to detect placeholder or missing auth/database env values.

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function includesAny(value: string, needles: string[]): boolean {
  const v = value.toLowerCase();
  return needles.some((needle) => v.includes(needle.toLowerCase()));
}

export function isDatabaseConfigured(databaseUrl: string | undefined): boolean {
  if (!hasValue(databaseUrl)) return false;
  return !includesAny(databaseUrl!, [
    "user:password@",
    "ep-xxx",
    "example",
    "your-",
  ]);
}

export function isGoogleOAuthConfigured(
  clientId: string | undefined,
  clientSecret: string | undefined
): boolean {
  if (!hasValue(clientId) || !hasValue(clientSecret)) return false;
  return !includesAny(clientId!, ["your-google-client-id", "example"]);
}

export function isFacebookOAuthConfigured(
  clientId: string | undefined,
  clientSecret: string | undefined
): boolean {
  if (!hasValue(clientId) || !hasValue(clientSecret)) return false;
  return !includesAny(clientId!, ["your-facebook-app-id", "example"]);
}

