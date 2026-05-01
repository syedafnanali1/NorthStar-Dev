"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { AuthConfigStatus } from "@/lib/env-checks";
import { cn } from "@/lib/utils";
import { registerSchema, type RegisterInput } from "@/lib/validators/auth";

interface RegisterFormProps {
  inviteToken?: string;
  initialProviderStatus: AuthConfigStatus;
}

const COUNTRY_OPTIONS = [
  "United States",
  "Canada",
  "United Kingdom",
  "Australia",
  "Germany",
  "France",
  "India",
  "Pakistan",
  "United Arab Emirates",
  "Saudi Arabia",
  "Other",
] as const;

const DIAL_CODES = [
  { label: "US/CA (+1)", value: "+1" },
  { label: "UK (+44)", value: "+44" },
  { label: "AU (+61)", value: "+61" },
  { label: "DE (+49)", value: "+49" },
  { label: "FR (+33)", value: "+33" },
  { label: "IN (+91)", value: "+91" },
  { label: "PK (+92)", value: "+92" },
  { label: "UAE (+971)", value: "+971" },
  { label: "SA (+966)", value: "+966" },
];

function suggestUsername(fullName: string): string {
  const base = fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!base) return "";
  return base.slice(0, 30);
}

export function RegisterForm({
  inviteToken,
  initialProviderStatus,
}: RegisterFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [providerStatus] = useState<AuthConfigStatus>(initialProviderStatus);

  const [dialCode, setDialCode] = useState("+1");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      countryRegion: "United States",
      username: "",
      referralCode: "",
      profilePhotoDataUrl: "",
    },
    mode: "onChange",
  });

  const watchedEmail = watch("email");
  const watchedFullName = watch("fullName");
  const watchedUsername = watch("username");

  useEffect(() => {
    const digits = phoneLocal.replace(/\D/g, "");
    const e164 = `${dialCode}${digits}`;
    setValue("phoneNumber", e164, { shouldValidate: true });
  }, [dialCode, phoneLocal, setValue]);

  useEffect(() => {
    if (!watchedFullName || usernameManuallyEdited || watchedUsername) return;
    const suggestion = suggestUsername(watchedFullName);
    if (suggestion) {
      setValue("username", suggestion, { shouldValidate: true });
    }
  }, [watchedFullName, watchedUsername, usernameManuallyEdited, setValue]);

  useEffect(() => {
    const email = watchedEmail?.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setEmailStatus("idle");
      return;
    }

    setEmailStatus("checking");
    const timeout = setTimeout(() => {
      fetch(`/api/auth/email-check?email=${encodeURIComponent(email)}`)
        .then((res) => res.json())
        .then((json: { data?: { available?: boolean } }) => {
          setEmailStatus(json.data?.available ? "available" : "taken");
        })
        .catch(() => setEmailStatus("idle"));
    }, 450);

    return () => clearTimeout(timeout);
  }, [watchedEmail]);

  const emailHint = useMemo(() => {
    if (!watchedEmail) return null;
    if (emailStatus === "checking") return "Checking availability...";
    if (emailStatus === "taken") return "An account already uses this email.";
    if (emailStatus === "available") return "Email is available.";
    return null;
  }, [emailStatus, watchedEmail]);

  const onSubmit = async (data: RegisterInput) => {
    setLoading(true);
    setServerError(null);

    try {
      if (emailStatus === "taken") {
        setServerError("An account with this email already exists.");
        return;
      }

      const normalizedEmail = data.email.trim().toLowerCase();
      const payload: RegisterInput & { inviteToken?: string } = {
        ...data,
        email: normalizedEmail,
        inviteToken,
      };

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as {
        success?: boolean;
        message?: string;
        code?: string;
        data?: { redirectTo?: string };
      };

      if (!res.ok || !json.success) {
        setServerError(json.message ?? "Registration failed");
        return;
      }

      router.push(json.data?.redirectTo ?? `/auth/verify-email?email=${encodeURIComponent(normalizedEmail)}`);
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
    await signIn(provider, { callbackUrl: "/dashboard" });
  };

  const handleProfilePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setValue("profilePhotoDataUrl", "", { shouldValidate: true });
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setServerError("Profile photo must be JPEG, PNG, or WEBP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setServerError("Profile photo must be 5MB or less.");
      return;
    }

    let dataUrl: string;
    try {
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.readAsDataURL(file);
      });
    } catch {
      setServerError("Could not read the image file. Please try a different photo.");
      return;
    }

    setValue("profilePhotoDataUrl", dataUrl, { shouldValidate: true });
  };

  const inputClass = (hasError: boolean) =>
    cn(
      "w-full px-4 py-3 rounded-xl text-sm border text-white placeholder:text-white/25 outline-none transition-all bg-white/5",
      hasError ? "border-rose" : "border-white/10 focus:border-gold/50"
    );

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => handleOAuth("google")}
        disabled={!!oauthLoading || (providerStatus ? !providerStatus.googleConfigured : false)}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-white/10 bg-white/5 text-white text-sm font-medium hover:bg-white/10 transition-all disabled:opacity-50"
      >
        {oauthLoading === "google" ? (
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
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
        className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-white/10 bg-white/5 text-white text-sm font-medium hover:bg-white/10 transition-all disabled:opacity-50"
      >
        {oauthLoading === "facebook" ? (
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        )}
        Continue with Facebook
      </button>

      {providerStatus && !providerStatus.facebookConfigured ? (
        <p className="text-xs text-amber-300/90">
          Facebook sign-in is temporarily unavailable.
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
        <span className="text-xs text-white/25">or email</span>
        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <input type="hidden" {...register("phoneNumber")} />
        <input type="hidden" {...register("profilePhotoDataUrl")} />
        {serverError && <div className="px-3 py-2 rounded-lg bg-rose/20 text-rose text-sm">{serverError}</div>}

        {providerStatus && !providerStatus.databaseConfigured ? (
          <div className="px-3 py-2 rounded-lg bg-amber-200/10 text-amber-300 text-sm">
            Database is not configured. Email registration will not work until DATABASE_URL is set.
          </div>
        ) : null}

        {providerStatus && !providerStatus.emailDeliveryConfigured ? (
          <div className="px-3 py-2 rounded-lg bg-amber-200/10 text-amber-300 text-sm">
            Email sign-up is temporarily unavailable while email delivery is being configured. Use Google sign-in for now.
          </div>
        ) : null}

        <div>
          <input {...register("fullName")} placeholder="Full Name" className={inputClass(!!errors.fullName)} />
          {errors.fullName && <p className="text-xs text-rose mt-1">{errors.fullName.message}</p>}
        </div>

        <div>
          <input {...register("email")} type="email" placeholder="Email" autoComplete="email" className={inputClass(!!errors.email)} />
          {errors.email && <p className="text-xs text-rose mt-1">{errors.email.message}</p>}
          {emailHint ? (
            <p className={cn("text-xs mt-1", emailStatus === "taken" ? "text-rose" : "text-white/45")}>{emailHint}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-[150px,1fr] gap-2">
          <select
            value={dialCode}
            onChange={(event) => setDialCode(event.target.value)}
            className={inputClass(false)}
          >
            {DIAL_CODES.map((code) => (
              <option key={code.value} value={code.value} className="text-black">
                {code.label}
              </option>
            ))}
          </select>
          <input
            value={phoneLocal}
            onChange={(event) => setPhoneLocal(event.target.value)}
            placeholder="Phone number"
            className={inputClass(!!errors.phoneNumber)}
          />
        </div>
        {errors.phoneNumber && <p className="text-xs text-rose mt-1">{errors.phoneNumber.message}</p>}

        <div>
          <input
            type="date"
            {...register("dateOfBirth")}
            className={inputClass(!!errors.dateOfBirth)}
          />
          {errors.dateOfBirth && <p className="text-xs text-rose mt-1">{errors.dateOfBirth.message}</p>}
        </div>

        <div>
          <select {...register("countryRegion")} className={inputClass(!!errors.countryRegion)}>
            {COUNTRY_OPTIONS.map((country) => (
              <option key={country} value={country} className="text-black">
                {country}
              </option>
            ))}
          </select>
          {errors.countryRegion && <p className="text-xs text-rose mt-1">{errors.countryRegion.message}</p>}
        </div>

        <div>
          <input
            {...register("username")}
            placeholder="Username (optional)"
            className={inputClass(!!errors.username)}
            onChange={(event) => {
              setUsernameManuallyEdited(true);
              setValue("username", event.target.value, { shouldValidate: true });
            }}
          />
          {errors.username && <p className="text-xs text-rose mt-1">{errors.username.message}</p>}
        </div>

        <div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleProfilePhotoChange}
            className={inputClass(!!errors.profilePhotoDataUrl)}
          />
          <p className="text-xs text-white/35 mt-1">Optional profile photo (max 5MB)</p>
          {errors.profilePhotoDataUrl && <p className="text-xs text-rose mt-1">{errors.profilePhotoDataUrl.message}</p>}
        </div>

        <div>
          <input {...register("referralCode")} placeholder="Referral code (optional)" className={inputClass(!!errors.referralCode)} />
          {errors.referralCode && <p className="text-xs text-rose mt-1">{errors.referralCode.message}</p>}
        </div>

        <div>
          <input {...register("password")} type="password" placeholder="Password (12+ chars, upper/lower/number/symbol)" className={inputClass(!!errors.password)} />
          {errors.password && <p className="text-xs text-rose mt-1">{errors.password.message}</p>}
        </div>

        <div>
          <input {...register("confirmPassword")} type="password" placeholder="Confirm Password" className={inputClass(!!errors.confirmPassword)} />
          {errors.confirmPassword && <p className="text-xs text-rose mt-1">{errors.confirmPassword.message}</p>}
        </div>

        <button
          type="submit"
          disabled={
            loading ||
            (providerStatus
              ? !providerStatus.databaseConfigured || !providerStatus.emailDeliveryConfigured
              : false)
          }
          className="w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 bg-gold text-ink hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? <div className="w-4 h-4 border-2 border-ink/20 border-t-ink rounded-full animate-spin" /> : null}
          Create Account
        </button>
      </form>
    </div>
  );
}
