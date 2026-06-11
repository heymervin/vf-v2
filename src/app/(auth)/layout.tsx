import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | VenueFlow",
    default: "VenueFlow",
  },
};

/**
 * Auth group layout — no app chrome.
 * Provides: navy-tinted background, small wordmark top-left, centered content card.
 * The content card itself is rendered inside each page so max-w and padding are
 * page-controlled (login vs signup may differ slightly).
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Wordmark — top-left, navy, no gradient (DESIGN.md ban) */}
      <header className="px-6 py-5">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          VenueFlow
        </span>
      </header>

      {/* Centered content area */}
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        {children}
      </main>
    </div>
  );
}
