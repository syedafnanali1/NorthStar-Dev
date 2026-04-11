// src/components/layout/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn, initials } from "@/lib/utils";
import type { Session } from "next-auth";
import {
  BarChart3,
  CalendarDays,
  Moon,
  Settings,
  Sun,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useTheme } from "@/components/layout/theme-provider";

interface SidebarProps {
  user: Session["user"] & { id?: string };
}

const DESKTOP_NAV_ITEMS = [
  { href: "/dashboard", label: "Goals", icon: Target },
  { href: "/calendar", label: "Daily Log", icon: CalendarDays },
  { href: "/circle", label: "Circle", icon: Users },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/groups", label: "Groups", icon: Trophy },
] as const;

// Clean 5-item mobile nav — no duplicates
const MOBILE_NAV_ITEMS = [
  { href: "/dashboard", label: "Goals", icon: Target },
  { href: "/calendar", label: "Log", icon: CalendarDays },
  { href: "/circle", label: "Circle", icon: Users },
  { href: "/groups", label: "Groups", icon: Trophy },
  { href: "/analytics", label: "Stats", icon: BarChart3 },
] as const;

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-expanded");
    const initial = saved !== null ? saved === "true" : window.innerWidth >= 1280;
    setExpanded(initial);
    document.documentElement.style.setProperty("--sidebar-width", initial ? "216px" : "72px");
    setMounted(true);
  }, []);

  const toggleSidebar = () => {
    setExpanded((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-expanded", String(next));
      document.documentElement.style.setProperty("--sidebar-width", next ? "216px" : "72px");
      return next;
    });
  };

  const showLabel = mounted ? expanded : false;

  return (
    <>
      {/* ── Desktop Sidebar ──────────────────────────────────── */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-cream-dark bg-cream-paper py-3 transition-all duration-300 lg:flex",
          mounted ? (expanded ? "w-[216px]" : "w-[72px]") : "w-[72px] xl:w-[216px]"
        )}
      >
        {/* Logo / Toggle */}
        <button
          type="button"
          onClick={toggleSidebar}
          title={expanded ? "Collapse sidebar" : "Expand sidebar"}
          className="mb-5 flex h-11 items-center gap-3 px-[18px] hover:opacity-75 transition-opacity"
        >
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-ink shadow-sm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L14.4 9.6H22L15.8 14.4L18.2 22L12 17.2L5.8 22L8.2 14.4L2 9.6H9.6L12 2Z"
                fill="#C4963A"
              />
            </svg>
          </span>
          <div className={cn("min-w-0 transition-all duration-200", showLabel ? "block" : "hidden")}>
            <p className="text-[0.8rem] font-bold tracking-tight text-ink leading-none">NorthStar</p>
            <p className="mt-0.5 text-[0.65rem] font-medium tracking-[0.18em] uppercase text-ink-muted leading-none">
              Goal Tracker
            </p>
          </div>
        </button>

        {/* Primary Nav */}
        <nav className="flex flex-1 flex-col gap-0.5 px-2.5">
          {DESKTOP_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={!showLabel ? item.label : undefined}
                className={cn(
                  "group relative flex h-10 items-center gap-3 rounded-xl px-2.5 text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-ink text-cream-paper"
                    : "text-ink-muted hover:bg-cream hover:text-ink"
                )}
              >
                <Icon
                  className="h-[17px] w-[17px] flex-shrink-0"
                  strokeWidth={isActive ? 2.2 : 1.75}
                />
                <span className={cn("transition-all duration-200 truncate", showLabel ? "block" : "hidden")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="flex flex-col gap-0.5 px-2.5 pt-2 border-t border-cream-dark">
          {/* Notification Bell */}
          <div className={cn("flex h-10 items-center rounded-xl", showLabel ? "w-full px-2.5" : "justify-center")}>
            <NotificationBell showLabel={showLabel} />
          </div>

          {/* Dark Mode Toggle */}
          <button
            type="button"
            title={theme.dark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={theme.toggle}
            className="flex h-10 w-full items-center gap-3 rounded-xl px-2.5 text-sm font-medium text-ink-muted transition-all duration-150 hover:bg-cream hover:text-ink"
          >
            {theme.dark ? (
              <Sun className="h-[17px] w-[17px] flex-shrink-0" strokeWidth={1.75} />
            ) : (
              <Moon className="h-[17px] w-[17px] flex-shrink-0" strokeWidth={1.75} />
            )}
            <span className={cn("truncate transition-all duration-200", showLabel ? "block" : "hidden")}>
              {theme.dark ? "Light mode" : "Dark mode"}
            </span>
          </button>

          {/* Settings */}
          <Link
            href="/profile"
            title={!showLabel ? "Settings" : undefined}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-xl px-2.5 text-sm font-medium transition-all duration-150",
              pathname.startsWith("/profile")
                ? "bg-ink text-cream-paper"
                : "text-ink-muted hover:bg-cream hover:text-ink"
            )}
          >
            <Settings className="h-[17px] w-[17px] flex-shrink-0" strokeWidth={1.75} />
            <span className={cn("truncate transition-all duration-200", showLabel ? "block" : "hidden")}>
              Settings
            </span>
          </Link>

          {/* Profile / Avatar */}
          <Link
            href="/profile"
            title={user?.name ?? "Profile"}
            className="flex h-12 w-full items-center gap-3 rounded-xl px-2.5 mt-0.5 transition-all duration-150 hover:bg-cream"
          >
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold text-[10px] font-bold text-ink ring-2 ring-cream-dark">
              {user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt={user.name ?? "User"} className="h-full w-full object-cover" />
              ) : (
                initials(user?.name)
              )}
            </span>
            <div className={cn("min-w-0 transition-all duration-200", showLabel ? "block" : "hidden")}>
              <p className="truncate text-[0.8125rem] font-semibold text-ink leading-tight">
                {user?.name ?? "Profile"}
              </p>
              <p className="truncate text-[0.6875rem] text-ink-muted leading-tight mt-0.5">
                {user?.email ?? ""}
              </p>
            </div>
          </Link>
        </div>
      </aside>

      {/* ── Mobile Top Header ────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-cream-dark/50 bg-cream-paper/95 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-2.5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5"
            title="North Star"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L14.4 9.6H22L15.8 14.4L18.2 22L12 17.2L5.8 22L8.2 14.4L2 9.6H9.6L12 2Z"
                  fill="#C4963A"
                />
              </svg>
            </span>
            <span className="text-[0.875rem] font-bold tracking-tight text-ink">NorthStar</span>
          </Link>

          <div className="ml-auto flex items-center gap-1.5">
            {/* Notification Bell */}
            <div className="flex items-center justify-center">
              <NotificationBell showLabel={false} />
            </div>

            {/* Dark Mode */}
            <button
              type="button"
              title={theme.dark ? "Light mode" : "Dark mode"}
              onClick={theme.toggle}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted transition-all hover:bg-cream hover:text-ink"
            >
              {theme.dark ? (
                <Sun className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <Moon className="h-4 w-4" strokeWidth={1.75} />
              )}
            </button>

            {/* Profile */}
            <Link
              href="/profile"
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gold text-[10px] font-bold text-ink ring-2 ring-cream-dark transition-transform hover:scale-105"
              title={user?.name ?? "Profile"}
            >
              {user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt={user.name ?? "User"}
                  className="h-full w-full object-cover"
                />
              ) : (
                initials(user?.name)
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Mobile Bottom Navigation ─────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-cream-dark/50 bg-cream-paper/98 pb-[calc(0.375rem+env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-sm grid-cols-5 gap-0.5 px-2">
          {MOBILE_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition-all duration-150",
                  isActive
                    ? "bg-ink text-cream-paper"
                    : "text-ink-muted hover:bg-cream hover:text-ink"
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.2 : 1.75} />
                <span className="text-[10px] font-semibold leading-none tracking-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
