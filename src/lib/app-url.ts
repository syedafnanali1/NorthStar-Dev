const LOCAL_APP_URL = "http://localhost:3000";

function normalizeBaseUrl(value: string | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  return withProtocol.replace(/\/+$/, "");
}

export function getAppUrl(): string {
  return (
    normalizeBaseUrl(process.env["NEXT_PUBLIC_APP_URL"]) ??
    normalizeBaseUrl(process.env["VERCEL_URL"]) ??
    normalizeBaseUrl(process.env["NEXTAUTH_URL"]) ??
    LOCAL_APP_URL
  );
}

export function appUrl(path = ""): string {
  const baseUrl = getAppUrl();
  if (!path) return baseUrl;

  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
