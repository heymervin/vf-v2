/**
 * Couple Portal — post-booking, couple-facing relationship layer.
 *
 * Server component: pulls mock data and passes it down to the client shell
 * (PortalClient) which owns tabs, optimistic state, and toasts.
 *
 * Route: /portal  (inside (portal) layout — warm bg, max-w-5xl)
 * Audience: Henderson & Carter via primaryWedding()
 */

import {
  primaryWedding,
  getContact,
  getConversation,
  VENUE,
  TEAM,
  daysFromToday,
  formatLongDate,
} from "@/lib/mock";
import { FLOORPLAN_TABLES, ROOM_ELEMENTS } from "@/lib/mock/planning";
import { PortalClient } from "./portal-client";

export default function PortalPage() {
  const wedding = primaryWedding();
  const contact = getContact(wedding.contactId);
  const messages = getConversation(wedding.contactId);

  // Coordinator display name
  const coordinator = wedding.coordinatorId
    ? TEAM.find((m) => m.id === wedding.coordinatorId)
    : null;

  // Partner first names — contact.partner1 = "Emma Henderson", partner2 = "James Carter"
  const partner1First = contact?.partner1.split(" ")[0] ?? "Partner 1";
  const partner2First = contact?.partner2.split(" ")[0] ?? "Partner 2";

  // Planning progress across couple-visible task categories
  const COUPLE_VISIBLE_CATEGORIES = new Set(["money", "planning"]);
  const coupleTasks = wedding.tasks.filter((t) =>
    COUPLE_VISIBLE_CATEGORIES.has(t.category),
  );
  const doneTasks = coupleTasks.filter((t) => t.done).length;
  const progressPct =
    coupleTasks.length > 0
      ? Math.round((doneTasks / coupleTasks.length) * 100)
      : 0;
  const nextTask = coupleTasks.find((t) => !t.done) ?? null;

  return (
    <PortalClient
      partner1First={partner1First}
      partner2First={partner2First}
      venueName={VENUE.name}
      venueEmail={VENUE.email}
      daysUntil={daysFromToday(wedding.date)}
      weddingDate={formatLongDate(wedding.date)}
      guestCount={wedding.guestCount}
      space={wedding.space}
      packageName={wedding.packageName}
      coupleTasks={coupleTasks}
      progressPct={progressPct}
      nextTask={nextTask}
      payments={wedding.payments}
      contractStatus={wedding.contractStatus}
      contractTerms={wedding.contractTerms ?? []}
      docs={wedding.docs}
      menu={wedding.menu}
      guests={wedding.guests}
      runsheet={wedding.runsheet}
      totalValue={wedding.totalValue}
      paid={wedding.paid}
      messages={messages}
      coordinatorName={coordinator?.name ?? "Your coordinator"}
      floorplanTables={FLOORPLAN_TABLES}
      roomElements={ROOM_ELEMENTS}
      portalTheme={wedding.portalTheme ?? null}
    />
  );
}
