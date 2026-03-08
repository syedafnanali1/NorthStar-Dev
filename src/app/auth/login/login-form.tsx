// src/app/auth/login/login-form.tsx
"use client";

import { useState } from "react";
import { useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [providerStatus, setProviderStatus] = useState<{
    googleConfigured: boolean;
    facebookConfigured: boolean;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    fetch("/api/auth/config-status")
      .then((res) => res.json())
      .then((json: { googleConfigured: boolean; facebookConfigured: boolean }) => {
        setProviderStatus(json);
      })
      .catch(() => {
        setProviderStatus(null);
      });
  }, []);

  const onSubmit = async (data: LoginInput) => {
    setLoading(true);
    setServerError(null);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setServerError("Invalid email or password");
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
      setServerError("Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local.");
      return;
    }
    if (provider === "facebook" && providerStatus && !providerStatus.facebookConfigured) {
      setServerError("Facebook OAuth is not configured. Set FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET in .env.local.");
      return;
    }
    setOauthLoading(provider);
    try {
      await signIn(provider, { callbackUrl: "/dashboard" });
    } catch {
      setOauthLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* OAuth Buttons */}
      <button
        type="button"
        onClick={() => handleOAuth("google")}
        disabled={!!oauthLoading || (providerStatus ? !providerStatus.googleConfigured : false)}
        className={cn(
          "w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl",
          "border border-white/10 bg-white/5 text-white text-sm font-medium",
          "hover:bg-white/10 transition-all disabled:opacity-50"
        )}
      >
        {oauthLoading === "google" ? (
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        )}
        Continue with Google
      </button>

      <button
        type="button"
        onClick={() => handleOAuth("facebook")}
        disabled={!!oauthLoading || (providerStatus ? !providerStatus.facebookConfigured : false)}
        className={cn(
          "w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl",
          "border border-white/10 bg-white/5 text-white text-sm font-medium",
          "hover:bg-white/10 transition-all disabled:opacity-50"
        )}
      >
        {oauthLoading === "facebook" ? (
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        )}
        Continue with Facebook
      </button>
      {providerStatus && (!providerStatus.googleConfigured || !providerStatus.facebookConfigured) && (
        <p className="text-xs text-amber-300/90">
          OAuth disabled until provider keys are set in <code>.env.local</code>.
        </p>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
        <span className="text-xs text-white/25">or email</span>
        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
      </div>

      {/* Email/Password form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {serverError && (
          <div className="px-3 py-2 rounded-lg bg-rose/20 text-rose text-sm">
            {serverError}
          </div>
        )}

        <div>
          <input
            {...register("email")}
            type="email"
            placeholder="Email"
            autoComplete="email"
            className={cn(
              "w-full px-4 py-3 rounded-xl text-sm",
              "border text-white placeholder:text-white/25",
              "outline-none transition-all bg-white/5",
              errors.email
                ? "border-rose"
                : "border-white/10 focus:border-gold/50"
            )}
          />
          {errors.email && (
            <p className="text-xs text-rose mt-1">{errors.email.message}</p>
          )}
        </div>

        <div>
          <input
            {...register("password")}
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            className={cn(
              "w-full px-4 py-3 rounded-xl text-sm",
              "border text-white placeholder:text-white/25",
              "outline-none transition-all bg-white/5",
              errors.password
                ? "border-rose"
                : "border-white/10 focus:border-gold/50"
            )}
          />
          {errors.password && (
            <p className="text-xs text-rose mt-1">{errors.password.message}</p>
          )}
        </div>

        <div className="text-right">
          <a
            href="/auth/forgot-password"
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Forgot password?
          </a>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={cn(
            "w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all",
            "flex items-center justify-center gap-2",
            "bg-gold text-ink hover:opacity-90 active:scale-[0.98]",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
          ) : null}
          Sign In →
        </button>
      </form>
    </div>
  );
}
