// src/app/goals/new/page.tsx
import type { Metadata } from "next";
import { requireAuth, requireAuthUser } from "@/lib/auth/helpers";
import { AppLayout } from "@/components/layout/app-layout";
import { NewGoalWizard } from "./new-goal-wizard";

export const metadata: Metadata = {
  title: "New Goal",
};

export default async function NewGoalPage() {
  await requireAuth();
  await requireAuthUser();

  return (
    <AppLayout contentClassName="max-w-3xl lg:max-w-xl">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">
          Plant a New Star
        </p>
        <h1 className="mt-3 text-3xl font-serif text-ink sm:text-4xl">
          Plant a New Star
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          Turn an intention into something measurable, emotionally grounded, and easy to revisit.
        </p>
      </div>
      <NewGoalWizard />
    </AppLayout>
  );
}
