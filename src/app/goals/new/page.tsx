// src/app/goals/new/page.tsx
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/helpers";
import { AppLayout } from "@/components/layout/app-layout";
import { NewGoalWizard } from "./new-goal-wizard";

export const metadata: Metadata = {
  title: "New Goal",
};

export default async function NewGoalPage() {
  await requireAuth();

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <p className="text-2xs uppercase tracking-widest text-ink-muted mb-1">
            Plant a Star
          </p>
          <h1 className="text-3xl font-serif text-ink">New Goal</h1>
        </div>
        <NewGoalWizard />
      </div>
    </AppLayout>
  );
}
