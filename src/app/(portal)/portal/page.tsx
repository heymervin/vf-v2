/**
 * Couple Portal — post-booking, couple-facing relationship layer.
 *
 * Server component: pulls mock data and passes it down to the client shell
 * (PortalClient) which owns the Tabs + toasts + interactive state.
 *
 * Route: /portal  (inside (portal) layout — warm gradient bg, max-w-5xl)
 * Audience: Henderson & Carter via primaryWedding()
 */

import {
  primaryWedding,
  getContact,
  VENUE,
  daysFromToday,
  formatLongDate,
} from "@/lib/mock";
import { PortalClient } from "./portal-client";

export default function PortalPage() {
  const wedding = primaryWedding();
  const contact = getContact(wedding.contactId);

  // Partner first names — contact.partner1 = "Emma Henderson", partner2 = "James Carter"
  const partner1First = contact?.partner1.split(" ")[0] ?? "Partner 1";
  const partner2First = contact?.partner2.split(" ")[0] ?? "Partner 2";

  // Couple-facing tasks: not done, exclude internal admin that couples can't act on
  const COUPLE_VISIBLE_CATEGORIES = new Set(["money", "planning"]);
  const coupleTasks = wedding.tasks.filter(
    (t) => !t.done && COUPLE_VISIBLE_CATEGORIES.has(t.category),
  );

  return (
    <PortalClient
      partner1First={partner1First}
      partner2First={partner2First}
      venueName={VENUE.name}
      daysUntil={daysFromToday(wedding.date)}
      weddingDate={formatLongDate(wedding.date)}
      guestCount={wedding.guestCount}
      coupleTasks={coupleTasks}
      payments={wedding.payments}
      contractStatus={wedding.contractStatus}
      menu={wedding.menu}
      guests={wedding.guests}
      runsheet={wedding.runsheet}
      totalValue={wedding.totalValue}
      paid={wedding.paid}
      space={wedding.space}
    />
  );
}
