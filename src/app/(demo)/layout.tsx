import type { Metadata } from "next";
import { DemoSidebar } from "@/components/layout/demo-sidebar";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: { default: "VenueFlow v2 Preview", template: "%s · VenueFlow v2" },
  description:
    "Prototype of the VenueFlow v2 combined platform — GoHighLevel-class sales + Sonas-class wedding planning in one product.",
};

/**
 * Demo shell for the no-login /preview showcase of the v2 combined platform.
 * Mirrors the real app shell (dark navy sidebar + scrollable content) but reads
 * seeded mock data and has no auth/tenant gate — see PRODUCT.md › The Combined
 * Platform. The real app (M0–M7) lives under (app) and is unaffected.
 */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DemoSidebar />
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto px-5 py-7 md:px-8">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
