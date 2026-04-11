// src/app/auth/forgot-password/page.tsx
"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        setError(j.error ?? "Failed to send reset email");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#0E0C0A" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <svg className="mx-auto mb-4" width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L14.4 9.6H22L15.8 14.4L18.2 22L12 17.2L5.8 22L8.2 14.4L2 9.6H9.6L12 2Z" fill="#C4963A" />
          </svg>
          <h1 className="text-3xl font-serif text-white mb-2">Reset Password</h1>
        </div>
        <div className="rounded-3xl p-8" style={{ background: "#1C1917", border: "1px solid #2A2522" }}>
          {sent ? (
            <div className="text-center">
              <div className="text-4xl mb-4">📧</div>
              <h2 className="text-xl font-serif text-white mb-2">Check your email</h2>
              <p className="text-sm text-white/40 mb-6">
                We sent a password reset link to <strong className="text-white/70">{email}</strong>.
                It expires in 1 hour.
              </p>
              <a href="/auth/login" className="text-sm text-gold hover:text-gold-light">← Back to sign in</a>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-serif text-white mb-1">Forgot your password?</h2>
              <p className="text-sm text-white/30 mb-7">
                Enter your email and we&apos;ll send you a reset link.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div className="px-3 py-2 rounded-lg bg-rose/20 text-rose text-sm">{error}</div>}
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm border border-white/10 bg-white/5 text-white placeholder:text-white/25 outline-none focus:border-gold/50"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gold text-ink font-semibold text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <div className="w-4 h-4 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />}
                  Send Reset Link →
                </button>
              </form>
              <p className="text-center mt-5 text-sm text-white/30">
                <a href="/auth/login" className="text-gold/70 hover:text-gold">← Back to sign in</a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
