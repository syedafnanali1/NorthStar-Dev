// src/components/layout/app-layout.tsx
// Main application layout with sidebar navigation and right panel

import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { Sidebar } from "./sidebar";
import { RightPanel } from "./right-panel";

interface AppLayoutProps {
  children: React.ReactNode;
}

export async function AppLayout({ children }: AppLayoutProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/login");
  }

  return (
    <div className="flex min-h-screen">
      {/* Left Sidebar Navigation */}
      <Sidebar user={session.user} />

      {/* Main Content Area */}
      <main
        className="flex-1 min-w-0 overflow-y-auto"
        style={{
          marginLeft: "68px",
          marginRight: "280px",
        }}
      >
        <div className="max-w-3xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>

      {/* Right Panel - Constellation, Intentions, Circle */}
      <RightPanel userId={session.user.id ?? ""} />
    </div>
  );
}
