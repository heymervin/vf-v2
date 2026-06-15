import { primaryWedding, WED_PRIMARY_ID, formatLongDate } from "@/lib/mock";
import { RunsheetClient } from "./runsheet-client";

export const metadata = { title: "Run-sheet" };

/**
 * Run-sheet page — server shell.
 *
 * Reads wedding data (server-side) and passes it to RunsheetClient, which
 * owns all interactivity: mode toggle, check-off state, live clock, filters.
 *
 * DESIGN.md: calm, dense, tablet-first in Event-Day mode, 44px+ touch targets.
 */
export default function RunsheetPage() {
  const wedding = primaryWedding();

  return (
    <RunsheetClient
      wedding={{
        coupleName: wedding.coupleName,
        date: wedding.date,
        space: wedding.space,
        guestCount: wedding.guestCount,
        runsheet: wedding.runsheet,
        suppliers: wedding.suppliers,
        keyFacts: wedding.keyFacts,
      }}
      weddingId={WED_PRIMARY_ID}
      formattedDate={formatLongDate(wedding.date)}
    />
  );
}
