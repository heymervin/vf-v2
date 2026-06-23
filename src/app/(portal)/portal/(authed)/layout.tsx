import { redirect } from "next/navigation";
import Image from "next/image";
import { resolveCoupleContext } from "../portal-data";

/**
 * Guarded couple-portal chrome.
 *
 * Server component. Immediately calls getUser() (inside resolveCoupleContext)
 * and redirects unauthenticated callers to /portal/login BEFORE any portal data
 * is fetched (spec §9). Renders the white-labeled venue header/footer using only
 * the safe venue branding columns. No "Prototype" badge.
 *
 * This layout wraps ONLY the authenticated portal data pages — /portal/login and
 * /portal/auth/* sit above it (in the route group) and stay public.
 */
export default async function GuardedPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await resolveCoupleContext();
  if (!ctx) redirect("/portal/login");

  return (
    <>
      <header className="border-b border-border/60 bg-card/60 supports-backdrop-filter:backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            {ctx.venue.logoUrl && (
              <Image
                src={ctx.venue.logoUrl}
                alt={`${ctx.venue.name} logo`}
                width={40}
                height={40}
                className="size-10 rounded-lg object-contain"
                unoptimized
              />
            )}
            <div>
              <p className="text-base font-semibold tracking-tight text-foreground">
                {ctx.venue.name}
              </p>
              <p className="text-xs text-muted-foreground">Wedding Portal</p>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
      <footer className="mx-auto max-w-5xl px-5 py-8 text-center text-xs text-muted-foreground">
        Powered by VenueFlow
      </footer>
    </>
  );
}
