import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { AccessBanner } from "@/components/layout/access-banner";
import { Toaster } from "@/components/ui/sonner";

/**
 * App shell layout — server component.
 *
 * Auth / onboarding gates:
 *  - unauthenticated  → /login  (defense in depth; proxy already gates)
 *  - no-venue         → /onboarding
 *  - venue exists but onboarding not completed → /onboarding (resumes)
 *
 * Renders: dark navy sidebar + slim topbar + scrollable main content area.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getTenantContext();

  if (!ctx.ok) {
    if (ctx.reason === "unauthenticated") redirect("/login");
    if (ctx.reason === "no-venue") redirect("/onboarding");
  }

  // TypeScript narrowing — ctx is ok: true from here
  if (!ctx.ok) return null;

  if (ctx.venue.onboardingCompletedAt === null) redirect("/onboarding");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar (desktop/tablet) + mobile topbar + mobile sheet — client component */}
      <AppSidebar venueName={ctx.venue.name} userEmail={ctx.user.email} />

      {/* Right column: topbar + scrollable content */}
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        <AppTopbar venueName={ctx.venue.name} userEmail={ctx.user.email} />

        <AccessBanner access={ctx.access} trialEndsAt={ctx.venue.trialEndsAt} />

        <main className="flex-1 overflow-y-auto px-6 py-8 md:px-8">
          {children}
        </main>
      </div>

      <Toaster />
    </div>
  );
}
