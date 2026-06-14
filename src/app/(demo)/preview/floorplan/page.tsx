import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { primaryWedding, WED_PRIMARY_ID, formatLongDate } from "@/lib/mock";
import type { Guest } from "@/lib/mock";
import { FloorplanClient } from "./FloorplanClient";
import type { TableGroup } from "./FloorplanClient";

export const metadata = { title: "Floor plan" };

// Capacity assumption: 10 per table throughout the prototype.
const TABLE_CAPACITY = 10;

export default function FloorplanPage() {
  const wedding = primaryWedding();
  const guests: Guest[] = wedding.guests;

  // -------------------------------------------------------------------------
  // Derive table groups from guest data.
  // Guests with table === null OR rsvp === "no" → unassigned bucket.
  // -------------------------------------------------------------------------
  const tableMap = new Map<number, Guest[]>();
  const unassigned: Guest[] = [];

  for (const g of guests) {
    if (g.table === null || g.rsvp === "no") {
      // declined or no assignment → unassigned
      unassigned.push(g);
    } else {
      const existing = tableMap.get(g.table) ?? [];
      existing.push(g);
      tableMap.set(g.table, existing);
    }
  }

  // Build sorted table list (1..12). Include tables that appear in the data
  // plus fill in any missing numbers up to the highest found.
  const maxTable = tableMap.size > 0 ? Math.max(...tableMap.keys()) : 12;
  const tableCount = Math.max(maxTable, 12);

  const tables: TableGroup[] = Array.from({ length: tableCount }, (_, i) => ({
    tableNumber: i + 1,
    guests: tableMap.get(i + 1) ?? [],
  }));

  const totalSeated = guests.filter(
    (g) => g.table !== null && g.rsvp !== "no",
  ).length;
  const totalGuests = guests.filter((g) => g.rsvp !== "no").length;

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
        tables={tables}
        unassigned={unassigned}
        totalSeated={totalSeated}
        totalGuests={totalGuests}
        tableCapacity={TABLE_CAPACITY}
      />
    </div>
  );
}
