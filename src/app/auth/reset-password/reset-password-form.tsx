"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 12) {
      setError("Password must be at least 12 characters");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword: confirm }),
      });
      const json = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(json.message ?? "Reset failed");
        return;
      }

      router.push("/auth/login?reset=1");
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0E0C0A] p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <svg className="mx-auto mb-4" width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L14.4 9.6H22L15.8 14.4L18.2 22L12 17.2L5.8 22L8.2 14.4L2 9.6H9.6L12 2Z"
              fill="#C4963A"
            />
          </svg>
          <h1 className="mb-2 text-3xl font-serif text-white">New Password</h1>
        </div>
        <div className="rounded-3xl border border-[#2A2522] bg-[#1C1917] p-8">
          <h2 className="mb-1 text-xl font-serif text-white">Choose a new password</h2>
          <p className="mb-7 text-sm text-white/30">
            At least 12 characters with uppercase, lowercase, number, and symbol.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? (
              <div className="rounded-lg bg-rose/20 px-3 py-2 text-sm text-rose">
                {error}
              </div>
            ) : null}
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="New password"
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-gold/50"
            />
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Confirm password"
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-gold/50"
            />
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <div className="h-4 w-4 rounded-full border-2 border-ink/20 border-t-ink animate-spin" />
              ) : null}
              Reset Password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
