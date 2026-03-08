// src/app/layout.tsx
// Root layout — applies to every page in the app

import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { Providers } from "@/components/layout/providers";

export const metadata: Metadata = {
  title: {
    default: "North Star — Goal Tracker",
    template: "%s | North Star",
  },
  description:
    "Track your goals, build daily habits, and connect with your accountability circle. Small actions. Extraordinary results.",
  keywords: ["goal tracker", "habit tracker", "accountability", "productivity"],
  openGraph: {
    type: "website",
    title: "North Star — Goal Tracker",
    description: "Small actions. Extraordinary results.",
    siteName: "North Star",
  },
  twitter: {
    card: "summary_large_image",
    title: "North Star — Goal Tracker",
    description: "Small actions. Extraordinary results.",
  },
};

export const viewport: Viewport = {
  themeColor: "#1A1714",
  width: "device-width",
  initialScale: 1,
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
