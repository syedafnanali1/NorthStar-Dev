// src/components/layout/providers.tsx
"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { TodayTasksProvider } from "@/lib/contexts/today-tasks-context";
import { InactivityLogout } from "@/components/layout/inactivity-logout";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // Create a stable QueryClient instance per component tree
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <InactivityLogout />
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TodayTasksProvider>
            {children}
          </TodayTasksProvider>
          <Toaster />
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
