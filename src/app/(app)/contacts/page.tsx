import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { ContactsToolbar } from "./contacts-toolbar";
import { formatWeddingDate, formatBudget } from "./format";

export const metadata = { title: "Contacts" };

function sanitizeSearch(q: string): string {
  return q.replace(/[,()*]/g, " ").trim();
}

interface ContactRow {
  id: string;
  couple_names: string;
  wedding_date: string | null;
  guest_count_day: number | null;
  guest_count_evening: number | null;
  total_value_minor: number | null;
  source: string;
  ghl_contact_id: string | null;
  couple_accounts: { email: string }[];
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; source?: string }>;
}) {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const sp = await searchParams;
  const q = sp.q ? sanitizeSearch(sp.q) : "";
  const source = sp.source ?? "";

  const supabase = await createClient();

  let query = supabase
    .from("weddings")
    .select(
      "id, couple_names, wedding_date, guest_count_day, guest_count_evening, total_value_minor, source, ghl_contact_id, couple_accounts(email)",
    )
    .eq("venue_id", ctx.venue.id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (q) query = query.ilike("couple_names", `%${q}%`);
  if (source) query = query.eq("source", source);

  // The contacts query is filtered by q/source, so the source dropdown needs its
  // own unfiltered scan. The two are independent — run them in parallel.
  const [
    { data, error },
    { data: sourceRows },
  ] = await Promise.all([
    query.overrideTypes<ContactRow[]>(),
    supabase
      .from("weddings")
      .select("source")
      .eq("venue_id", ctx.venue.id)
      .not("source", "is", null),
  ]);
  if (error) console.error("contacts query failed:", error.message);
  const contacts = data ?? [];

  const sources = Array.from(
    new Set((sourceRows ?? []).map((r) => r.source).filter(Boolean)),
  ).sort();

  const isFiltered = !!q || !!source;

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-8">
        <h1 className="title-shimmer-underline inline-block text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
          Contacts
        </h1>
        <p className="mt-5 text-sm text-muted-foreground">
          Booked couples for {ctx.venue.name}, synced from GHL.
        </p>
      </div>

      <div className="mb-5">
        <ContactsToolbar sources={sources} />
      </div>

      {contacts.length === 0 ? (
        <EmptyState filtered={isFiltered} />
      ) : (
        <ContactsTable contacts={contacts} />
      )}
    </div>
  );
}

function ContactsTable({ contacts }: { contacts: ContactRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="hidden grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] gap-4 border-b border-border px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground md:grid">
        <span>Name</span>
        <span>Email</span>
        <span>Wedding date</span>
        <span>Guests</span>
        <span>Value</span>
        <span>GHL</span>
      </div>

      <ul className="divide-y divide-border">
        {contacts.map((c) => {
          const email = c.couple_accounts[0]?.email ?? null;
          const guests = (c.guest_count_day ?? 0) + (c.guest_count_evening ?? 0);
          return (
            <li key={c.id} className="group relative">
              <Link
                href={`/weddings/${c.id}`}
                className="grid grid-cols-1 gap-2 px-5 py-4 transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none md:grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] md:items-center md:gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{c.couple_names}</p>
                  {c.source && (
                    <p className="text-xs text-muted-foreground">{c.source}</p>
                  )}
                </div>

                <div className="min-w-0 text-sm text-muted-foreground">
                  {email ? <p className="truncate">{email}</p> : <span>—</span>}
                </div>

                <div className="text-sm text-foreground tabular-nums">
                  {formatWeddingDate(c.wedding_date) ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>

                <div className="text-sm text-foreground tabular-nums">
                  {guests > 0 ? guests : <span className="text-muted-foreground">—</span>}
                </div>

                <div className="text-sm text-foreground tabular-nums">
                  {formatBudget(c.total_value_minor) ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>

                <div onClick={(e) => e.preventDefault()}>
                  {c.ghl_contact_id ? (
                    <a
                      href={`https://app.gohighlevel.com/contacts/${c.ghl_contact_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      aria-label="Open in GHL"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
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
            Try clearing the search or filters to see all contacts.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-foreground">
            No contacts yet
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Contacts appear here when an opportunity is marked as won in GHL.
          </p>
        </>
      )}
    </div>
  );
}
