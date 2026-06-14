"use client";

import { useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { StageBadge } from "@/components/stage-badge";
import { ContactsFilterBar } from "./contacts-filter-bar";
import { formatLongDate, type Contact } from "@/lib/mock";

interface ContactsTableClientProps {
  contacts: Contact[];
}

export function ContactsTableClient({ contacts }: ContactsTableClientProps) {
  const [visible, setVisible] = useState<Contact[]>(contacts);

  return (
    <div className="flex flex-col gap-5">
      <ContactsFilterBar contacts={contacts} onFilter={setVisible} />
      {visible.length === 0 ? (
        <EmptyState filtered={visible.length !== contacts.length} />
      ) : (
        <ContactsTable contacts={visible} />
      )}
    </div>
  );
}

function ContactsTable({ contacts }: { contacts: Contact[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Column headers — desktop only */}
      <div className="hidden grid-cols-[2fr_1.5fr_1.2fr_1fr_0.8fr] gap-4 border-b border-border px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground md:grid">
        <span>Name</span>
        <span>Contact</span>
        <span>Stage</span>
        <span>Wedding date</span>
        <span>Source</span>
      </div>

      <ul className="divide-y divide-border">
        {contacts.map((c) => (
          <li key={c.id}>
            <Link
              href={`/preview/contacts/${c.id}`}
              className="grid grid-cols-1 gap-2 px-5 py-4 transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none md:grid-cols-[2fr_1.5fr_1.2fr_1fr_0.8fr] md:items-center md:gap-4 min-h-[44px]"
            >
              {/* Name + guest count */}
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {c.coupleName}
                </p>
                {c.guestCount != null && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {c.guestCount} guests
                  </p>
                )}
              </div>

              {/* Email / phone */}
              <div className="min-w-0 text-sm text-muted-foreground">
                {c.email && <p className="truncate">{c.email}</p>}
                {c.phone && (
                  <p className="truncate tabular-nums">{c.phone}</p>
                )}
              </div>

              {/* Stage */}
              <div>
                <StageBadge stage={c.stage} />
              </div>

              {/* Wedding date */}
              <div className="text-sm text-foreground tabular-nums">
                {c.weddingDate ? (
                  formatLongDate(c.weddingDate)
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>

              {/* Source */}
              <div className="truncate text-sm text-muted-foreground">
                {c.source}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-10 text-center shadow-sm">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Users className="size-6" />
      </div>
      {filtered ? (
        <>
          <h2 className="text-lg font-semibold text-foreground">
            No contacts match these filters
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Try clearing the search or switching stage filter to see all
            enquiries.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-foreground">
            No contacts yet
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Contacts appear here once your enquiry form goes live, or you can
            add them manually.
          </p>
        </>
      )}
    </div>
  );
}
