import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { primaryWedding, WED_PRIMARY_ID, formatLongDate } from "@/lib/mock";
import { FLOORPLAN_TABLES, ROOM_ELEMENTS } from "@/lib/mock/planning";
import { FloorplanClient } from "./FloorplanClient";

export const metadata = { title: "Floor plan" };

export default function FloorplanPage() {
  const wedding = primaryWedding();

  const totalSeated = wedding.guests.filter(
    (g) => g.table !== null && g.rsvp !== "no",
  ).length;
  const totalGuests = wedding.guests.filter((g) => g.rsvp !== "no").length;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Floor plan"
        subtitle={`Seating layout for ${wedding.coupleName} — ${formatLongDate(wedding.date)} · ${wedding.space}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/preview/weddings/${WED_PRIMARY_ID}`}>
              {wedding.coupleName}
              <ExternalLink className="size-3.5" />
            </Link>
          </Button>
        }
      />

      <FloorplanClient
        floorplanTables={FLOORPLAN_TABLES}
        roomElements={ROOM_ELEMENTS}
        guests={wedding.guests}
        totalSeated={totalSeated}
        totalGuests={totalGuests}
      />
    </div>
  );
}
