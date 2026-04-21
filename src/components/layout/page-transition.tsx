// src/components/layout/page-transition.tsx
// Wraps page content with a native-feeling slide-up entrance animation.
// Use in page.tsx files to give each route a smooth entrance on mobile.
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname();
  const [animKey, setAnimKey] = useState(0);
  const prevPath = useRef(pathname);

  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      setAnimKey((k) => k + 1);
    }
  }, [pathname]);

  return (
    <div
      key={animKey}
      className={cn("animate-page-in", className)}
      style={{ animationDuration: "280ms" }}
    >
      {children}
    </div>
  );
}
