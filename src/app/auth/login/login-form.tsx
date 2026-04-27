"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, EyeOff, Sparkles } from "lucide-react";

import type { AuthConfigStatus } from "@/lib/env-checks";
import { cn } from "@/lib/utils";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";

interface LoginActionLink {
  href: string;
  label: string;
}

interface LoginFormProps {
  initialProviderStatus: AuthConfigStatus;
}

interface LoginCheckResponse {
  success?: boolean;
  code?: string;
  message?: string;
  data?: {
    registerUrl?: string;
    forgotPasswordUrl?: string;
    verifyUrl?: string;
    provider?: string | null;
  };
}

export function LoginForm({ initialProviderStatus }: LoginFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverActionLink, setServerActionLink] = useState<LoginActionLink | null>(null);
  const [providerStatus] = useState<AuthConfigStatus>(initialProviderStatus);

  const searchParams = useSearchParams();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    const verified = searchParams?.get("verified");
    if (verified === "1") {
      setServerError("Email verified. You can sign in now.");
      setServerActionLink(null);
      return;
    }

    const errorParam = searchParams?.get("error");
    if (errorParam) {
      setServerError(
        errorParam === "Configuration"
          ? "This sign-in option is temporarily unavailable."
          : errorParam === "CredentialsSignin"
          ? "Sign in failed. Check your credentials and try again."
          : "Authentication failed. Please try again."
      );
    }
  }, [searchParams]);

  const onSubmit = async (data: LoginInput) => {
    setLoading(true);
    setServerError(null);
    setServerActionLink(null);

    const normalizedEmail = data.email.trim().toLowerCase();

    try {
      const checkRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password: data.password }),
      });

      const checkJson = (await checkRes.json()) as LoginCheckResponse;

      if (!checkRes.ok || checkJson.success === false) {
        setServerError(
          checkJson.message ?? "Unable to verify credentials. Please try again."
        );

        if (checkJson.code === "NO_ACCOUNT" && checkJson.data?.registerUrl) {
          setServerActionLink({ href: checkJson.data.registerUrl, label: "Create account" });
        } else if (
          checkJson.code === "PASSWORD_NOT_SET" &&
          (checkJson.data?.provider === "google" || checkJson.data?.provider === "facebook")
        ) {
          const provider = checkJson.data.provider as "google" | "facebook";
          setLoading(false);
          await handleOAuth(provider);
          return;
        } else if (
          (
            checkJson.code === "INCORRECT_PASSWORD" ||
            checkJson.code === "ACCOUNT_LOCKED" ||
            checkJson.code === "PASSWORD_NOT_SET"
          ) &&
          checkJson.data?.forgotPasswordUrl
        ) {
          setServerActionLink({ href: checkJson.data.forgotPasswordUrl, label: "Forgot password?" });
        } else if (checkJson.code === "EMAIL_UNVERIFIED" && checkJson.data?.verifyUrl) {
          setServerActionLink({ href: checkJson.data.verifyUrl, label: "Verify email" });
        }

        return;
      }

      const result = await signIn("credentials", {
        email: normalizedEmail,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setServerError("Sign in failed. Please try again or reset your password.");
        setServerActionLink({ href: "/auth/forgot-password", label: "Forgot password?" });
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setServerError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "facebook") => {
    if (provider === "google" && providerStatus && !providerStatus.googleConfigured) {
      setServerError(
        "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local or your deployment environment."
      );
      return;
    }
    if (provider === "facebook" && providerStatus && !providerStatus.facebookConfigured) {
      setServerError(
        "Facebook sign-in is temporarily unavailable."
      );
      return;
    }

    setOauthLoading(provider);
    try {
      await signIn(provider, { callbackUrl: "/dashboard" });
    } catch {
      setOauthLoading(null);
    }
  };

  const handleDemoMode = async () => {
    setDemoLoading(true);
    setServerError(null);
    setServerActionLink(null);

    try {
      const response = await fetch("/api/auth/demo", { method: "POST" });
      const json = (await response.json()) as { email?: string; password?: string; error?: string };

      if (!response.ok || !json.email || !json.password) {
        throw new Error(json.error ?? "Demo mode is unavailable");
      }

      const result = await signIn("credentials", {
        email: json.email,
        password: json.password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error("Failed to start demo mode");
      }

      window.location.href = "/dashboard";
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Demo mode is unavailable"
      );
    } finally {
      setDemoLoading(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    cn(
      "w-full min-h-[52px] rounded-2xl border bg-white/5 px-4 text-sm text-white outline-none transition-all placeholder:text-white/28",
      hasError ? "border-rose" : "border-white/10 focus:border-gold/50"
    );

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => handleOAuth("google")}
        disabled={!!oauthLoading || (providerStatus ? !providerStatus.googleConfigured : false)}
        className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition-all hover:bg-white/10 disabled:opacity-50"
      >
        {oauthLoading === "google" ? (
          <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
        )}
        Continue with Google
      </button>

      <button
        type="button"
        onClick={() => handleOAuth("facebook")}
        disabled={!!oauthLoading || (providerStatus ? !providerStatus.facebookConfigured : false)}
        className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition-all hover:bg-white/10 disabled:opacity-50"
      >
        {oauthLoading === "facebook" ? (
          <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
            <path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        )}
        Continue with Facebook
      </button>

      {providerStatus && !providerStatus.facebookConfigured ? (
        <p className="text-xs text-amber-300/90">
          Facebook sign-in is temporarily unavailable.
        </p>
      ) : null}

      <div className="flex items-center gap-3 pt-1">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs uppercase tracking-[0.22em] text-white/30">or email</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {serverError ? (
          <div className="rounded-2xl bg-rose/20 px-4 py-3 text-sm text-rose space-y-2">
            <p>{serverError}</p>
            {serverActionLink ? (
              <Link href={serverActionLink.href} className="inline-block text-gold hover:text-gold-light">
                {serverActionLink.label}
              </Link>
            ) : null}
          </div>
        ) : null}

        <div>
          <input
            {...register("email")}
            type="email"
            placeholder="Email"
            autoComplete="email"
            className={inputClass(!!errors.email)}
          />
          {errors.email ? (
            <p className="mt-1 text-xs text-rose">{errors.email.message}</p>
          ) : null}
        </div>

        <div>
          <input
            {...register("password")}
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            className={inputClass(!!errors.password)}
          />
          {errors.password ? (
            <p className="mt-1 text-xs text-rose">{errors.password.message}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-between text-xs text-white/35">
          <Link href="/auth/forgot-password" className="transition-colors hover:text-white/70">
            Forgot password?
          </Link>
          <span className="inline-flex items-center gap-1">
            <EyeOff className="h-3.5 w-3.5" />
            Private by default
          </span>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gold px-4 text-sm font-semibold text-ink transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
        >
          {loading ? (
            <div className="h-4 w-4 rounded-full border-2 border-ink/20 border-t-ink animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          Sign In
        </button>
      </form>

      <button
        type="button"
        onClick={handleDemoMode}
        disabled={demoLoading}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-transparent px-4 text-sm font-medium text-white/85 transition-all hover:bg-white/6 disabled:opacity-50"
      >
        {demoLoading ? (
          <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        Continue without account (demo mode)
      </button>
    </div>
  );
}
