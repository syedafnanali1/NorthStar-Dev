import type { Metadata } from "next";

import { VerifyEmailForm } from "./verify-email-form";

export const metadata: Metadata = {
  title: "Verify Email",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string;
    code?: string;
    mode?: "email" | "signin";
    provider?: "google" | "facebook";
  }>;
}) {
  const { email, code, mode, provider } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#0E0C0A" }}>
      <VerifyEmailForm
        initialEmail={email}
        initialCode={code}
        initialMode={mode}
        initialProvider={provider}
      />
    </div>
  );
}
