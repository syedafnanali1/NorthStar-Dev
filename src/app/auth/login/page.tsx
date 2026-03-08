// src/app/auth/login/page.tsx
import type { Metadata } from "next";
import { redirectIfAuthenticated } from "@/lib/auth/helpers";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign In",
};

export default async function LoginPage() {
  await redirectIfAuthenticated("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#0E0C0A" }}>
      {/* Background stars */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 60 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-px h-px rounded-full animate-twinkle"
            style={{
              background: "white",
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
              opacity: Math.random() * 0.6,
              width: Math.random() > 0.7 ? "2px" : "1px",
              height: Math.random() > 0.7 ? "2px" : "1px",
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-up">
          <div className="inline-flex items-center justify-center w-12 h-12 mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L14.4 9.6H22L15.8 14.4L18.2 22L12 17.2L5.8 22L8.2 14.4L2 9.6H9.6L12 2Z"
                fill="#C4963A"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-serif text-white mb-2">North Star</h1>
          <p className="text-sm text-white/40 font-mono tracking-wide uppercase">
            Welcome back
          </p>
        </div>

        {/* Form card */}
        <div
          className="rounded-3xl p-8 animate-slide-in"
          style={{
            background: "#1C1917",
            border: "1px solid #2A2522",
          }}
        >
          <h2 className="text-xl font-serif text-white mb-1">Sign in to continue your journey.</h2>
          <p className="text-sm text-white/30 mb-7">Track goals, build habits, achieve more.</p>
          <LoginForm />
        </div>

        <p className="text-center mt-5 text-sm text-white/30">
          Don&apos;t have an account?{" "}
          <a href="/auth/register" className="text-gold hover:text-gold-light transition-colors">
            Create one free
          </a>
        </p>
        <p className="text-center mt-2">
          <a href="/dashboard?demo=1" className="text-xs text-white/20 hover:text-white/40 transition-colors">
            Continue without account (demo mode)
          </a>
        </p>
      </div>
    </div>
  );
}
