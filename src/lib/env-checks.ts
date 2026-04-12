// src/lib/env-checks.ts
// Utility helpers to detect placeholder or missing auth/database env values.

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function includesAny(value: string, needles: string[]): boolean {
  const v = value.toLowerCase();
  return needles.some((needle) => v.includes(needle.toLowerCase()));
}

function isTrue(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export interface AuthConfigStatus {
  databaseConfigured: boolean;
  googleConfigured: boolean;
  facebookConfigured: boolean;
  emailDeliveryConfigured: boolean;
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
  return (
    !includesAny(clientId!, ["your-google-client-id", "example"]) &&
    !includesAny(clientSecret!, ["your-google-client-secret", "example"])
  );
}

export function isFacebookOAuthConfigured(
  clientId: string | undefined,
  clientSecret: string | undefined
): boolean {
  if (!hasValue(clientId) || !hasValue(clientSecret)) return false;
  return (
    !includesAny(clientId!, ["your-facebook-app-id", "example"]) &&
    !includesAny(clientSecret!, ["your-facebook-app-secret", "example"])
  );
}

export function isFacebookOAuthAvailable(
  clientId: string | undefined,
  clientSecret: string | undefined
): boolean {
  if (!isFacebookOAuthConfigured(clientId, clientSecret)) return false;

  if (process.env["NODE_ENV"] === "production") {
    return isTrue(process.env["FACEBOOK_LOGIN_ENABLED"]);
  }

  return process.env["FACEBOOK_LOGIN_ENABLED"]?.trim().toLowerCase() !== "false";
}

export function isEmailDeliveryConfigured(
  apiKey: string | undefined,
  fromAddress: string | undefined
): boolean {
  if (!hasValue(apiKey) || !hasValue(fromAddress)) return false;
  // Reject obvious placeholder values
  if (includesAny(apiKey!, ["re_test_", "your-resend-api-key", "example"])) return false;
  // onboarding@resend.dev is Resend's test-only address — it can ONLY send to the
  // Resend account owner's email. Real users will never receive these emails.
  // A verified custom domain must be used for production email delivery.
  if (includesAny(fromAddress!, ["onboarding@resend.dev"])) return false;
  return true;
}

export function getAuthConfigStatus(
  env: NodeJS.ProcessEnv = process.env
): AuthConfigStatus {
  return {
    databaseConfigured: isDatabaseConfigured(env["DATABASE_URL"]),
    googleConfigured: isGoogleOAuthConfigured(
      env["GOOGLE_CLIENT_ID"],
      env["GOOGLE_CLIENT_SECRET"]
    ),
    facebookConfigured: isFacebookOAuthAvailable(
      env["FACEBOOK_CLIENT_ID"],
      env["FACEBOOK_CLIENT_SECRET"]
    ),
    emailDeliveryConfigured: isEmailDeliveryConfigured(
      env["RESEND_API_KEY"],
      env["EMAIL_FROM"]
    ),
  };
}
