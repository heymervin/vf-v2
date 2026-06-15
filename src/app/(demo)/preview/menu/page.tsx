import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { primaryWedding } from "@/lib/mock";
import { MenuClient } from "./menu-client";

export const metadata = { title: "Menu & catering" };

/**
 * Menu & catering — server shell.
 *
 * Data is extracted here (server component); all interactivity lives in
 * MenuClient (client component). This keeps the page fast and avoids
 * "use client" pollution on the data layer.
 */
export default function MenuPage() {
  const wedding = primaryWedding();
  const weddingHref = `/preview/weddings/${wedding.id}`;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Menu & catering"
        subtitle={`${wedding.coupleName} · ${wedding.space} · ${wedding.guestCount} guests`}
        actions={
          <Link
            href={weddingHref}
            className="text-sm font-medium text-primary hover:underline"
          >
            ← Back to wedding
          </Link>
        }
      />

      <MenuClient
        courses={wedding.menu}
        guests={wedding.guests}
        guestCount={wedding.guestCount}
      />
    </div>
  );
}
