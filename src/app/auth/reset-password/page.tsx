// src/app/auth/reset-password/page.tsx
"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword: confirm }),
      });
      const j = await res.json() as { error?: string };
      if (!res.ok) { setError(j.error ?? "Reset failed"); return; }
      router.push("/auth/login?reset=1");
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0E0C0A" }}>
        <p className="text-white/50">Invalid reset link.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#0E0C0A" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <svg className="mx-auto mb-4" width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L14.4 9.6H22L15.8 14.4L18.2 22L12 17.2L5.8 22L8.2 14.4L2 9.6H9.6L12 2Z" fill="#C4963A" />
          </svg>
          <h1 className="text-3xl font-serif text-white mb-2">New Password</h1>
        </div>
        <div className="rounded-3xl p-8" style={{ background: "#1C1917", border: "1px solid #2A2522" }}>
          <h2 className="text-xl font-serif text-white mb-1">Choose a new password</h2>
          <p className="text-sm text-white/30 mb-7">At least 8 characters, 1 uppercase, 1 number.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="px-3 py-2 rounded-lg bg-rose/20 text-rose text-sm">{error}</div>}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="New password" required
              className="w-full px-4 py-3 rounded-xl text-sm border border-white/10 bg-white/5 text-white placeholder:text-white/25 outline-none focus:border-gold/50" />
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password" required
              className="w-full px-4 py-3 rounded-xl text-sm border border-white/10 bg-white/5 text-white placeholder:text-white/25 outline-none focus:border-gold/50" />
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-gold text-ink font-semibold text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <div className="w-4 h-4 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />}
              Reset Password →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
