import { requireAuthUser } from "@/lib/auth/helpers";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";
import { RightPanel } from "./right-panel";
import { SplashScreen } from "@/components/ui/splash-screen";
import { XpToastProvider } from "@/components/ui/xp-toast";

interface AppLayoutProps {
  children: React.ReactNode;
  contentClassName?: string;
  rightPanelVariant?: "default" | "circle" | "calendar";
}

export async function AppLayout({
  children,
  contentClassName,
  rightPanelVariant = "default",
}: AppLayoutProps) {
  const user = await requireAuthUser();

  return (
    <div className="min-h-screen overflow-x-clip bg-cream">
      <SplashScreen />
      <XpToastProvider />
      <Sidebar
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        }}
      />
      {/*
        Layout breakpoints:
         <lg  (<1024px): full-width content, mobile bottom nav, no sidebar/right panel
          lg  (1024–1279px): sidebar 72px left, right panel 312px right
          xl  (1280px+): sidebar 216px left, right panel 312px right
      */}
      <main
        className={cn(
          "relative z-10",
          // Mobile — comfortable horizontal padding, extra bottom for bottom nav + safe area
          "px-4 pt-3",
          // Bottom: room for fixed bottom nav (52px) + safe-area-inset-bottom + extra breathing room
          "pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]",
          // Tablet
          "sm:px-5 sm:pt-4",
          "md:px-6 md:pt-5",
          // Desktop — offset for sidebar + right panel
          "lg:ml-[var(--sidebar-width)] lg:mr-[var(--right-panel-width)]",
          "lg:px-6 lg:pt-7 lg:pb-10",
          "xl:px-8 xl:pt-8"
        )}
      >
        <div className={cn("mx-auto w-full min-w-0 lg:max-w-[840px] xl:max-w-[900px]", contentClassName)}>
          {children}
        </div>
      </main>
      <RightPanel userId={user.id} variant={rightPanelVariant} />
    </div>
  );
}
