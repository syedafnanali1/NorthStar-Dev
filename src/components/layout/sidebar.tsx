// src/components/layout/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn, initials } from "@/lib/utils";
import type { Session } from "next-auth";

interface SidebarProps {
  user: Session["user"];
}

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Goals",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
      </svg>
    ),
  },
  {
    href: "/calendar",
    label: "Daily Log",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    href: "/circle",
    label: "Circle",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-[68px] flex flex-col items-center py-5 gap-2 z-40"
      style={{
        background: "#1A1714",
        borderRight: "1px solid #2A2522",
      }}
    >
      {/* Logo */}
      <Link
        href="/dashboard"
        className="mb-4 flex items-center justify-center w-9 h-9"
        title="North Star"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L14.4 9.6H22L15.8 14.4L18.2 22L12 17.2L5.8 22L8.2 14.4L2 9.6H9.6L12 2Z"
            fill="#C4963A"
            stroke="#C4963A"
            strokeWidth="0.5"
          />
        </svg>
      </Link>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200",
                isActive
                  ? "text-gold bg-white/8"
                  : "text-ink-muted hover:text-cream hover:bg-white/5"
              )}
              style={{
                color: isActive ? "#C4963A" : undefined,
                background: isActive ? "rgba(255,255,255,0.07)" : undefined,
              }}
            >
              {item.icon}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Profile avatar */}
      <div className="flex flex-col items-center gap-2 mt-auto">
        <Link
          href="/profile"
          title="Profile"
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-ink overflow-hidden transition-transform hover:scale-110"
          style={{ background: "#C4963A" }}
        >
          {user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt={user.name ?? "User"} className="w-full h-full object-cover" />
          ) : (
            <span className="text-ink font-bold text-xs">
              {initials(user?.name)}
            </span>
          )}
        </Link>
      </div>
    </aside>
  );
}
