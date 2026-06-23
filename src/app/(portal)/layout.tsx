import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wedding Portal",
  description: "Plan your wedding day — payments, menu, guest list and more.",
};

/**
 * Couple Portal route-group shell.
 *
 * Intentionally does NOT guard or fetch venue data — the unauthenticated
 * `/portal/login` page and the `/portal/auth/*` callback must render before any
 * session exists. The auth guard + venue branding live in the nested
 * `portal/layout.tsx`, which wraps only the authenticated data pages
 * ("guard only the portal data pages" per the spec route-group note).
 *
 * Warmer than the staff app: a soft gradient background, generous spacing, no
 * app chrome.
 */
export default function PortalRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-accent/40 via-background to-background">
      {children}
    </div>
  );
}
