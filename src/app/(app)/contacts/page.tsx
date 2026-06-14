import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { StageBadge } from "@/components/stage-badge";
import { ContactsToolbar } from "./contacts-toolbar";
import { formatWeddingDate, contactDisplayName } from "./format";
import { STAGE_VALUES, type PipelineStage } from "@/lib/pipeline";

export const metadata = { title: "Contacts" };

// Strip PostgREST `or`-filter delimiters so a search term can't break the query.
function sanitizeSearch(q: string): string {
  return q.replace(/[,()*]/g, " ").trim();
}

interface ContactListRow {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  wedding_date: string | null;
  guest_count: number | null;
  source: string | null;
  created_at: string;
  opportunities: { id: string; stage: PipelineStage; archived_at: string | null }[];
}

const SORT_KEYS = ["newest", "oldest", "name", "wedding_date"] as const;
type SortKey = (typeof SORT_KEYS)[number];

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string; source?: string; sort?: string }>;
}) {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const sp = await searchParams;
  const q = sp.q ? sanitizeSearch(sp.q) : "";
  const stage: PipelineStage | null =
    sp.stage && STAGE_VALUES.includes(sp.stage as PipelineStage)
      ? (sp.stage as PipelineStage)
      : null;
  const source = sp.source ?? "";
  const sort: SortKey =
    sp.sort && SORT_KEYS.includes(sp.sort as SortKey)
      ? (sp.sort as SortKey)
      : "newest";

  const supabase = await createClient();

  // Active opportunity is embedded; inner-join only when filtering by stage so
  // the stage filter actually excludes non-matching contacts.
  const oppEmbed = stage
    ? "opportunities!inner(id, stage, archived_at)"
    : "opportunities(id, stage, archived_at)";

  // Build the order clause from the ?sort= param.
  const orderClause: { column: string; ascending: boolean; nullsFirst?: boolean }[] =
    sort === "oldest"
      ? [{ column: "created_at", ascending: true }]
      : sort === "name"
        ? [
            { column: "last_name", ascending: true, nullsFirst: false },
            { column: "first_name", ascending: true },
          ]
        : sort === "wedding_date"
          ? [{ column: "wedding_date", ascending: true, nullsFirst: false }]
          : [{ column: "created_at", ascending: false }]; // "newest" default

  let query = supabase
    .from("contacts")
    .select(
      `id, first_name, last_name, email, phone, wedding_date, guest_count, source, created_at, ${oppEmbed}`,
    )
    .eq("venue_id", ctx.venue.id)
    .is("opportunities.archived_at", null)
    .limit(500);

  for (const o of orderClause) {
    query = query.order(o.column, {
      ascending: o.ascending,
      ...(o.nullsFirst !== undefined ? { nullsFirst: o.nullsFirst } : {}),
    });
  }

  if (q) {
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`,
    );
  }
  if (stage) query = query.eq("opportunities.stage", stage);
  if (source) query = query.eq("source", source);

  const { data, error } = await query.overrideTypes<ContactListRow[]>();
  if (error) console.error("contacts list query failed:", error.message);
  const contacts = data ?? [];

  // Distinct sources for the filter dropdown (small payload at MVP scale).
  const { data: sourceRows } = await supabase
    .from("contacts")
    .select("source")
    .eq("venue_id", ctx.venue.id)
    .not("source", "is", null);
  const sources = Array.from(
    new Set((sourceRows ?? []).map((r) => r.source).filter((s): s is string => !!s)),
  ).sort();

  const isFiltered = !!q || !!stage || !!source || sort !== "newest";

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-8">
        <h1 className="title-shimmer-underline inline-block text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
          Contacts
        </h1>
        <p className="mt-5 text-sm text-muted-foreground">
          Contacts for {ctx.venue.name}, with their current pipeline stage.
        </p>
      </div>

      <div className="mb-5">
        <ContactsToolbar sources={sources} />
      </div>

      {contacts.length === 500 && (
        <p className="mb-4 text-sm text-muted-foreground">
          Showing the 500 most recent contacts. Use search or filters to find
          specific records.
        </p>
      )}

      {contacts.length === 0 ? (
        <EmptyState filtered={isFiltered} />
      ) : (
        <ContactsTable contacts={contacts} />
      )}
    </div>
  );
}

function ContactsTable({ contacts }: { contacts: ContactListRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Column headers (desktop only) */}
      <div className="hidden grid-cols-[2fr_1.5fr_1.2fr_1fr_0.8fr] gap-4 border-b border-border px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground md:grid">
        <span>Name</span>
        <span>Contact</span>
        <span>Stage</span>
        <span>Wedding date</span>
        <span>Source</span>
      </div>

      <ul className="divide-y divide-border">
        {contacts.map((c) => {
          const opp = c.opportunities[0];
          return (
            <li key={c.id}>
              <Link
                href={`/contacts/${c.id}`}
                className="grid grid-cols-1 gap-2 px-5 py-4 transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none md:grid-cols-[2fr_1.5fr_1.2fr_1fr_0.8fr] md:items-center md:gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {contactDisplayName(c)}
                  </p>
                  {c.guest_count != null && (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {c.guest_count} guests
                    </p>
                  )}
                </div>

                <div className="min-w-0 text-sm text-muted-foreground">
                  {c.email && <p className="truncate">{c.email}</p>}
                  {c.phone && <p className="truncate tabular-nums">{c.phone}</p>}
                  {!c.email && !c.phone && <span>—</span>}
                </div>

                <div>
                  {opp ? <StageBadge stage={opp.stage} /> : <span className="text-sm text-muted-foreground">—</span>}
                </div>

                <div className="text-sm text-foreground tabular-nums">
                  {formatWeddingDate(c.wedding_date) ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>

                <div className="truncate text-sm text-muted-foreground">
                  {c.source ?? "—"}
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
            Try clearing the search or filters to see all of your enquiries.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-foreground">
            No contacts yet
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Add your first enquiry with{" "}
            <span className="font-medium text-foreground">New contact</span>, or
            it will appear here automatically once your lead form is live.
          </p>
        </>
      )}
    </div>
  );
}
