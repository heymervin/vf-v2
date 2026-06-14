import type { Metadata } from "next";
import { VENUE } from "@/lib/mock";

export const metadata: Metadata = {
  title: `${VENUE.name} · Wedding Portal`,
  description: "Plan your wedding day — payments, menu, guest list and more.",
};

/**
 * Couple Portal chrome — the post-booking, couple-facing surface (PRODUCT.md ›
 * Configurability: "couples never see the CRM app; after booking they get a
 * dedicated, templated planning portal"). Warmer than the staff app: venue name
 * forward, generous spacing, no app chrome. White-labeled to the venue.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-accent/40 via-background to-background">
      <header className="border-b border-border/60 bg-card/60 supports-backdrop-filter:backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-base font-semibold tracking-tight text-foreground">
              {VENUE.name}
            </p>
            <p className="text-xs text-muted-foreground">Wedding Portal</p>
          </div>
          <span className="rounded-full bg-fun-pink px-3 py-1 text-xs font-medium text-fun-pink-foreground">
            Prototype
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
      <footer className="mx-auto max-w-5xl px-5 py-8 text-center text-xs text-muted-foreground">
        Powered by VenueFlow
      </footer>
    </div>
  );
}
