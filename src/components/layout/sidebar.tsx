// src/components/layout/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn, initials } from "@/lib/utils";
import type { Session } from "next-auth";
import {
  BarChart3,
  CalendarDays,
  Moon,
  Settings,
  Star,
  Sun,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useTheme } from "@/components/layout/theme-provider";
import { useNavBadges } from "@/hooks/use-nav-badges";

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

const MOBILE_NAV_ITEMS = [
  { href: "/dashboard", label: "Goals", icon: Target },
  { href: null, label: "Log", icon: CalendarDays },
  { href: "/circle", label: "Circle", icon: Users },
  { href: "/groups", label: "Groups", icon: Trophy },
  { href: "/analytics", label: "Stats", icon: BarChart3 },
] as const;

const BADGE_HREFS: Record<string, keyof ReturnType<typeof useNavBadges>> = {
  "/circle": "notifications",
  "/groups": "groups",
  "/dashboard": "goals",
};

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const theme = useTheme();
  const badges = useNavBadges();
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const prevPath = useRef(pathname);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-expanded");
    const initial = saved !== null ? saved === "true" : window.innerWidth >= 1280;
    setExpanded(initial);
    document.documentElement.style.setProperty("--sidebar-width", initial ? "216px" : "72px");
    setMounted(true);
  }, []);

  // Haptic feedback on nav tap (Capacitor native)
  const triggerHaptic = async () => {
    try {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Not running in Capacitor — no-op
    }
  };

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
            const badgeKey = BADGE_HREFS[item.href];
            const badgeCount = badgeKey ? badges[badgeKey] : 0;

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
                <span className="relative flex-shrink-0">
                  <Icon
                    className="h-[17px] w-[17px]"
                    strokeWidth={isActive ? 2.2 : 1.75}
                  />
                  {badgeCount > 0 && !isActive && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose text-[8px] font-bold text-white leading-none">
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </span>
                  )}
                </span>
                <span className={cn("transition-all duration-200 truncate", showLabel ? "block" : "hidden")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="flex flex-col gap-0.5 px-2.5 pt-2 border-t border-cream-dark">
          <div className={cn("flex h-10 items-center rounded-xl", showLabel ? "w-full px-2.5" : "justify-center")}>
            <NotificationBell showLabel={showLabel} />
          </div>

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

          <Link
            href="/premium"
            title={!showLabel ? "Upgrade" : undefined}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-xl px-2.5 text-sm font-medium transition-all duration-150",
              pathname.startsWith("/premium")
                ? "bg-ink text-cream-paper"
                : "text-gold hover:bg-gold/10"
            )}
          >
            <Star className="h-[17px] w-[17px] flex-shrink-0 fill-gold" strokeWidth={1.75} />
            <span className={cn("truncate transition-all duration-200", showLabel ? "block" : "hidden")}>
              Upgrade
            </span>
          </Link>

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
      <header
        className="sticky top-0 z-40 border-b border-cream-dark/40 bg-cream-paper/92 backdrop-blur-[20px] [-webkit-backdrop-filter:blur(20px)] lg:hidden"
        style={{ paddingTop: "max(10px, env(safe-area-inset-top))" }}
      >
        <div className="mx-auto flex w-full max-w-lg items-center gap-3 px-4 pb-2.5">
          {/* Logo */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 select-none"
            title="NorthStar"
          >
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-ink shadow-sm flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L14.4 9.6H22L15.8 14.4L18.2 22L12 17.2L5.8 22L8.2 14.4L2 9.6H9.6L12 2Z"
                  fill="#C4963A"
                />
              </svg>
            </span>
            <p className="text-[0.9rem] font-bold tracking-tight text-ink leading-none">NorthStar</p>
          </Link>

          <div className="ml-auto flex items-center gap-0.5">
            {/* Notification Bell */}
            <div className="flex h-10 w-10 items-center justify-center">
              <NotificationBell showLabel={false} />
            </div>

            {/* Dark Mode */}
            <button
              type="button"
              title={theme.dark ? "Light mode" : "Dark mode"}
              onClick={theme.toggle}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted transition-all active:scale-90 active:bg-cream-dark/60 select-none"
            >
              {theme.dark ? (
                <Sun className="h-[18px] w-[18px]" strokeWidth={1.75} />
              ) : (
                <Moon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              )}
            </button>

            {/* Profile Avatar */}
            <Link
              href="/profile"
              className="ml-1 flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold text-[11px] font-bold text-ink ring-2 ring-cream-dark transition-transform active:scale-90 select-none"
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
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-cream-dark/50 bg-cream-paper/95 backdrop-blur-[24px] [-webkit-backdrop-filter:blur(24px)_saturate(180%)] lg:hidden"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto grid max-w-sm grid-cols-5 px-1 pt-1 pb-0.5">
          {MOBILE_NAV_ITEMS.map((item) => {
            const isLog = item.href === null;
            const isActive = !isLog && (pathname === item.href || pathname.startsWith((item.href ?? "") + "/"));
            const Icon = item.icon;
            const badgeKey = item.href ? BADGE_HREFS[item.href] : undefined;
            const badgeCount = badgeKey ? badges[badgeKey] : 0;

            const sharedClassName = cn(
              "select-none relative flex flex-col items-center justify-center gap-[3px] py-2 px-1",
              "transition-all duration-150 rounded-xl",
              "min-h-[52px]",
              isActive ? "text-ink" : "text-ink-muted active:text-ink"
            );

            const inner = (
              <>
                {isActive && (
                  <span
                    className="absolute inset-x-1.5 inset-y-1 rounded-xl"
                    style={{ background: "rgb(var(--ink-rgb) / 0.07)" }}
                  />
                )}
                <span className="relative z-10">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-xl transition-all duration-200",
                      isActive ? "bg-ink text-cream-paper" : "bg-transparent"
                    )}
                    style={isActive ? { transform: "scale(1.05)" } : { transform: "scale(1)" }}
                  >
                    <Icon
                      className="h-[17px] w-[17px]"
                      strokeWidth={isActive ? 2.2 : 1.75}
                    />
                  </span>
                  {badgeCount > 0 && !isActive && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose text-[8px] font-bold text-white leading-none">
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </span>
                  )}
                </span>
                <span
                  className={cn("relative z-10 font-semibold leading-none", isActive ? "text-ink" : "text-ink-muted")}
                  style={{ fontSize: "9.5px", letterSpacing: "0.02em" }}
                >
                  {item.label}
                </span>
              </>
            );

            if (isLog) {
              return (
                <button
                  key="log"
                  type="button"
                  className={sharedClassName}
                  onClick={() => {
                    void triggerHaptic();
                    window.dispatchEvent(new Event("northstar:open-checkin"));
                  }}
                >
                  {inner}
                </button>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href!}
                onClick={() => {
                  prevPath.current = pathname;
                  void triggerHaptic();
                }}
                className={sharedClassName}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
