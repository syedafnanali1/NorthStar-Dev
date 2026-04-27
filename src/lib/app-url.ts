const LOCAL_APP_URL = "http://localhost:3000";

function normalizeBaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const normalized = withProtocol.replace(/\/+$/, "");
  // Skip localhost values when other options are available
  if (normalized.includes("localhost") || normalized.includes("127.0.0.1")) return null;
  return normalized;
}

function normalizeBaseUrlAllowLocal(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

export function getAppUrl(): string {
  // Prefer explicitly-set server-side auth URLs over NEXT_PUBLIC_ (which may be localhost in dev)
  return (
    normalizeBaseUrl(process.env["AUTH_URL"]) ??
    normalizeBaseUrl(process.env["NEXTAUTH_URL"]) ??
    normalizeBaseUrl(process.env["NEXT_PUBLIC_APP_URL"]) ??
    normalizeBaseUrl(process.env["VERCEL_URL"]) ??
    normalizeBaseUrlAllowLocal(process.env["NEXT_PUBLIC_APP_URL"]) ??
    LOCAL_APP_URL
  );
}

export function appUrl(path = ""): string {
  const base = getAppUrl();
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
