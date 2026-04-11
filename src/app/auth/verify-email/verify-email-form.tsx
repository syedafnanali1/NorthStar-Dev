"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface VerifyEmailFormProps {
  initialEmail?: string;
  initialCode?: string;
  initialMode?: "email" | "signin";
  initialProvider?: "google" | "facebook";
}

export function VerifyEmailForm({
  initialEmail,
  initialCode,
  initialMode = "email",
  initialProvider,
}: VerifyEmailFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [otp, setOtp] = useState(initialCode ?? "");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const canResend = resendCountdown <= 0 && email.trim().length > 0;

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          otp,
          mode: initialMode,
          provider: initialProvider,
        }),
      });

      const json = (await response.json()) as {
        success?: boolean;
        message?: string;
        data?: { loginUrl?: string };
      };

      if (!response.ok || !json.success) {
        setError(json.message ?? "Verification failed.");
        return;
      }

      setMessage(json.message ?? "Email verified.");
      const nextUrl = json.data?.loginUrl ?? "/auth/login?verified=1";
      setTimeout(() => {
        if (nextUrl.startsWith("/api/auth/")) {
          window.location.assign(nextUrl);
          return;
        }
        router.push(nextUrl);
      }, 600);
    } catch {
      setError("Unable to verify code right now.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setResending(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, mode: initialMode }),
      });

      const json = (await response.json()) as {
        success?: boolean;
        message?: string;
        data?: { waitSeconds?: number; resendAfterSeconds?: number };
      };

      if (!response.ok || json.success === false) {
        setError(json.message ?? "Unable to resend verification email.");
        const waitSeconds = json.data?.waitSeconds;
        if (waitSeconds && waitSeconds > 0) {
          setResendCountdown(waitSeconds);
        }
        return;
      }

      const nextCountdown = json.data?.resendAfterSeconds ?? 60;
      setResendCountdown(nextCountdown);
      setMessage(json.message ?? "Verification code sent.");
    } catch {
      setError("Unable to resend verification code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="rounded-3xl p-8" style={{ background: "#1C1917", border: "1px solid #2A2522" }}>
        <h1 className="mb-2 text-3xl font-serif text-white">
          {initialMode === "signin" ? "Verify this sign-in" : "Verify your email"}
        </h1>
        <p className="mb-6 text-sm text-white/35">
          {initialMode === "signin"
            ? "Enter the 6-digit code to confirm this sign-in attempt. Use 'Resend code' to receive a fresh code."
            : "Enter the 6-digit code we sent to your inbox. Your account will activate after verification."}
        </p>

        <form onSubmit={handleVerify} className="space-y-4">
          {error ? <div className="rounded-lg bg-rose/20 px-3 py-2 text-sm text-rose">{error}</div> : null}
          {message ? <div className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">{message}</div> : null}

          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-white/45">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-gold/50"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-white/45">Verification Code</label>
            <input
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-2xl tracking-[0.4em] text-white placeholder:text-white/25 outline-none focus:border-gold/50"
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-ink hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Verifying..." : initialMode === "signin" ? "Verify Sign-In" : "Verify Email"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-white/50">
          <button
            type="button"
            onClick={handleResend}
            disabled={!canResend || resending}
            className="text-gold transition-colors hover:text-gold-light disabled:opacity-50"
          >
            {resending
              ? "Sending..."
              : resendCountdown > 0
                ? `Resend code in ${resendCountdown}s`
                : "Resend code"}
          </button>
          <a href="/auth/login" className="text-white/60 hover:text-white/85">
            Back to sign in
          </a>
        </div>
      </div>
    </div>
  );
}
