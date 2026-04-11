import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0E0C0A] px-4">
        <p className="text-white/50">Invalid reset link.</p>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
