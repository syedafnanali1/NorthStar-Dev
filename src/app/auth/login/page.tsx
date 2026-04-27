// src/app/auth/login/page.tsx
import type { Metadata } from "next";
import { redirectIfAuthenticated } from "@/lib/auth/helpers";
import { getAuthConfigStatus } from "@/lib/env-checks";
import { LoginForm } from "./login-form";
import { StarField } from "./star-field";

export const metadata: Metadata = {
  title: "Sign In",
};

export default async function LoginPage() {
  await redirectIfAuthenticated("/dashboard");
  const authConfigStatus = getAuthConfigStatus();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0E0C0A]">
      <StarField />

      <div className="relative z-10 flex min-h-screen items-stretch justify-center lg:items-center lg:p-4">
        <div className="mobile-sheet w-full bg-[#171411]/96 px-5 py-6 shadow-[0_30px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:max-w-[460px] lg:border lg:border-white/10 lg:px-7 lg:py-8">
          <div className="mx-auto mb-8 max-w-md">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/6">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L14.4 9.6H22L15.8 14.4L18.2 22L12 17.2L5.8 22L8.2 14.4L2 9.6H9.6L12 2Z"
                  fill="#C4963A"
                />
              </svg>
            </div>

            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/35">
              NorthStar
            </p>
            <h1 className="mt-3 text-3xl font-serif text-white lg:text-[1.75rem] lg:leading-[1.25]">
              Welcome back.
            </h1>
            <p className="mt-3 text-base leading-7 text-white/65 lg:text-[0.95rem] lg:leading-[1.55]">
              Sign in to continue your journey.
            </p>

            <div className="mt-8">
              <LoginForm initialProviderStatus={authConfigStatus} />
            </div>

            <p className="mt-6 text-center text-sm text-white/35">
              Don&apos;t have an account?{" "}
              <a
                href="/auth/register"
                className="font-medium text-gold transition-colors hover:text-gold-light"
              >
                Create one free
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
