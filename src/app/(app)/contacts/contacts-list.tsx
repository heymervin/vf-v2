"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ExternalLink, Download, Upload, RefreshCw, SlidersHorizontal, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataToolbar } from "@/components/data-toolbar";
import { SmartListBar } from "@/components/smart-list-bar";
import {
  SortableTable,
  type SortableColumn,
} from "@/components/sortable-table";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { ContactStatusBadge } from "@/components/status-badges";
import { contactDisplayName, formatWeddingDate, formatBudget } from "./format";
import { ContactFormSheet } from "./contact-form-sheet";
import { importContacts, importGhlContactsAction } from "./actions";
import { toCsv, downloadCsv } from "@/lib/csv";
import { scoreLead } from "@/lib/leads/score";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ContactRow {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  partner_first_name: string | null;
  partner_last_name: string | null;
  wedding_date: string | null;
  guest_count: number | null;
  budget_minor: number | null;
  source: string | null;
  ghl_contact_id: string | null;
  created_at: string;
  /** Derived server-side: "booked" if a wedding references this contact, else "lead". */
  status: "lead" | "booked";
  /** Derived server-side: booked with a future wedding date. */
  is_upcoming: boolean;
}

// ── Column visibility ──────────────────────────────────────────────────────

const TOGGLE_COLUMNS = [
  { key: "score", label: "Score" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "wedding_date", label: "Wedding date" },
  { key: "guests", label: "Guests" },
  { key: "value", label: "Value" },
  { key: "source", label: "Source" },
  { key: "created", label: "Created" },
] as const;

type ToggleKey = (typeof TOGGLE_COLUMNS)[number]["key"];
type ColumnVisibility = Record<ToggleKey, boolean>;

const DEFAULT_VISIBLE: ColumnVisibility = {
  score: true,
  email: true,
  phone: true,
  wedding_date: true,
  guests: true,
  value: true,
  source: true,
  created: false,
};

const COLS_STORAGE_KEY = "vf.contacts.columns";
const ALL = "all";

// ── Helpers ────────────────────────────────────────────────────────────────

function partnerName(c: ContactRow): string {
  return contactDisplayName({
    first_name: c.partner_first_name ?? "",
    last_name: c.partner_last_name,
  }).trim();
}

/** 0–100 lead score, colour-coded (hot/warm/cold). */
function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 70
      ? "text-fun-green-strong"
      : score >= 40
        ? "text-fun-pink-strong"
        : "text-muted-foreground";
  return <span className={`font-semibold tabular-nums ${tone}`}>{score}</span>;
}

function rowsToCsv(rows: ContactRow[]): string {
  const headers = [
    "Name",
    "Email",
    "Phone",
    "Wedding date",
    "Guests",
    "Value (£)",
    "Source",
    "Status",
    "Created",
  ];
  const data = rows.map((c) => [
    contactDisplayName(c),
    c.email ?? "",
    c.phone ?? "",
    c.wedding_date ?? "",
    c.guest_count ?? "",
    c.budget_minor != null ? (c.budget_minor / 100).toFixed(2) : "",
    c.source ?? "",
    c.status,
    c.created_at.slice(0, 10),
  ]);
  return toCsv(headers, data);
}

// ── Component ──────────────────────────────────────────────────────────────

export function ContactsList({ contacts }: { contacts: ContactRow[] }) {
  const router = useRouter();

  const [query, setQuery] = React.useState("");
  const [activeList, setActiveList] = React.useState("all");
  const [source, setSource] = React.useState(ALL);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = React.useState(false);
  const [visible, setVisible] = React.useState<ColumnVisibility>(DEFAULT_VISIBLE);

  // Load saved column prefs after hydration. localStorage is client-only, so a
  // lazy initializer would diverge from the server render — the effect is the
  // documented pattern for client-only state, despite the set-state-in-effect lint.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(COLS_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setVisible({ ...DEFAULT_VISIBLE, ...JSON.parse(raw) });
    } catch {
      /* ignore malformed prefs */
    }
  }, []);

  const toggleColumn = (key: ToggleKey) => {
    setVisible((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(COLS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota/availability errors */
      }
      return next;
    });
  };

  // CSV import — read the file, upsert via the server action, refresh.
  const fileRef = React.useRef<HTMLInputElement>(null);
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same filename
    if (!file) return;
    const res = await importContacts(await file.text());
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const { imported, skipped } = res.data;
    toast.success(
      `Imported ${imported} contact${imported === 1 ? "" : "s"}` +
        (skipped ? ` · skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}` : ""),
    );
    router.refresh();
  }

  // Pull every contact from the connected GHL location (main's importGhlContactsAction).
  const [syncing, startSync] = React.useTransition();
  function handleGhlSync() {
    startSync(async () => {
      const res = await importGhlContactsAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const { imported } = res.data;
      toast.success(`Synced ${imported} contact${imported === 1 ? "" : "s"} from GHL.`);
      router.refresh();
    });
  }

  // Saved-view counts
  const counts = React.useMemo(
    () => ({
      all: contacts.length,
      leads: contacts.filter((c) => c.status === "lead").length,
      booked: contacts.filter((c) => c.status === "booked").length,
      upcoming: contacts.filter((c) => c.is_upcoming).length,
    }),
    [contacts],
  );

  const sources = React.useMemo(
    () =>
      Array.from(
        new Set(contacts.map((c) => c.source).filter(Boolean) as string[]),
      ).sort(),
    [contacts],
  );

  // Filter pipeline: saved view → source → search.
  const filtered = React.useMemo(() => {
    let rows = contacts;
    if (activeList === "leads") rows = rows.filter((c) => c.status === "lead");
    else if (activeList === "booked") rows = rows.filter((c) => c.status === "booked");
    else if (activeList === "upcoming") rows = rows.filter((c) => c.is_upcoming);

    if (source !== ALL) rows = rows.filter((c) => c.source === source);

    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (c) =>
          contactDisplayName(c).toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [contacts, activeList, source, query]);

  // Build columns from visibility.
  const columns = React.useMemo<SortableColumn<ContactRow>[]>(() => {
    const cols: SortableColumn<ContactRow>[] = [
      {
        key: "name",
        header: "Name",
        sortable: true,
        sortValue: (c) => contactDisplayName(c).toLowerCase(),
        render: (c) => {
          const partner = partnerName(c);
          return (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  href={`/contacts/${c.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="truncate font-medium text-foreground hover:text-primary"
                >
                  {contactDisplayName(c)}
                </Link>
                <ContactStatusBadge status={c.status} />
              </div>
              {partner && (
                <p className="truncate text-xs text-muted-foreground">
                  with {partner}
                </p>
              )}
            </div>
          );
        },
      },
    ];

    if (visible.score)
      cols.push({
        key: "score",
        header: "Score",
        align: "right",
        sortable: true,
        sortValue: (c) => scoreLead(c),
        render: (c) =>
          c.status === "booked" ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <ScorePill score={scoreLead(c)} />
          ),
      });

    if (visible.email)
      cols.push({
        key: "email",
        header: "Email",
        render: (c) =>
          c.email ?? <span className="text-muted-foreground">—</span>,
      });

    if (visible.phone)
      cols.push({
        key: "phone",
        header: "Phone",
        render: (c) =>
          c.phone ?? <span className="text-muted-foreground">—</span>,
      });

    if (visible.wedding_date)
      cols.push({
        key: "wedding_date",
        header: "Wedding date",
        sortable: true,
        // Undated rows sort last in ascending order.
        sortValue: (c) => c.wedding_date ?? "9999-12-31",
        render: (c) =>
          formatWeddingDate(c.wedding_date) ?? (
            <span className="text-muted-foreground">—</span>
          ),
      });

    if (visible.guests)
      cols.push({
        key: "guests",
        header: "Guests",
        align: "right",
        sortable: true,
        sortValue: (c) => c.guest_count ?? 0,
        render: (c) =>
          c.guest_count != null ? (
            <span className="tabular-nums">{c.guest_count}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      });

    if (visible.value)
      cols.push({
        key: "value",
        header: "Value",
        align: "right",
        sortable: true,
        sortValue: (c) => c.budget_minor ?? 0,
        render: (c) =>
          formatBudget(c.budget_minor) ?? (
            <span className="text-muted-foreground">—</span>
          ),
      });

    if (visible.source)
      cols.push({
        key: "source",
        header: "Source",
        render: (c) =>
          c.source ?? <span className="text-muted-foreground">—</span>,
      });

    if (visible.created)
      cols.push({
        key: "created",
        header: "Created",
        sortable: true,
        sortValue: (c) => c.created_at,
        render: (c) => (
          <span className="tabular-nums text-muted-foreground">
            {formatWeddingDate(c.created_at.slice(0, 10))}
          </span>
        ),
      });

    cols.push({
      key: "ghl",
      header: "GHL",
      align: "center",
      render: (c) =>
        c.ghl_contact_id ? (
          <a
            href={`https://app.gohighlevel.com/contacts/${c.ghl_contact_id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex text-muted-foreground hover:text-foreground"
            aria-label="Open in GHL"
          >
            <ExternalLink className="size-3.5" />
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    });

    return cols;
  }, [visible]);

  // ── Empty (no contacts at all) ────────────────────────────────────────────
  if (contacts.length === 0) {
    return (
      <>
        <div className="rounded-xl border border-border bg-card p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Users className="size-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            No contacts yet
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Add an enquiry, or contacts will appear here as they sync from GHL.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => setFormOpen(true)}>
              <Plus /> New contact
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload /> Import CSV
            </Button>
            <Button variant="outline" onClick={handleGhlSync} disabled={syncing}>
              <RefreshCw className={syncing ? "animate-spin" : undefined} />
              Sync GHL
            </Button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleImport}
        />
        <ContactFormSheet open={formOpen} onOpenChange={setFormOpen} />
      </>
    );
  }

  const lists = [
    { id: "all", name: "All", count: counts.all },
    { id: "leads", name: "Leads", count: counts.leads },
    { id: "booked", name: "Booked", count: counts.booked },
    { id: "upcoming", name: "Upcoming", count: counts.upcoming },
  ];

  const selectedRows = filtered.filter((c) => selectedIds.has(c.id));

  return (
    <>
      <div className="mb-3">
        <SmartListBar lists={lists} activeId={activeList} onChange={setActiveList} />
      </div>

      <div className="mb-4">
        <DataToolbar
          search={{
            value: query,
            onChange: setQuery,
            placeholder: "Search by name, email, or phone",
          }}
          resultCount={filtered.length}
          totalCount={contacts.length}
          actions={
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" aria-label="Choose columns">
                    <SlidersHorizontal /> Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {TOGGLE_COLUMNS.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.key}
                      checked={visible[col.key]}
                      onCheckedChange={() => toggleColumn(col.key)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadCsv(rowsToCsv(filtered), "contacts.csv")}
              >
                <Download /> Export
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <Upload /> Import
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleGhlSync}
                disabled={syncing}
              >
                <RefreshCw className={syncing ? "animate-spin" : undefined} />
                Sync GHL
              </Button>

              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus /> New contact
              </Button>
            </>
          }
        >
          {sources.length > 0 && (
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger size="sm" className="h-8 min-w-[140px]" aria-label="Filter by source">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All sources</SelectItem>
                {sources.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </DataToolbar>
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-3">
          <BulkActionBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCsv(rowsToCsv(selectedRows), "contacts.csv")}
            >
              <Download /> Export CSV
            </Button>
          </BulkActionBar>
        </div>
      )}

      <SortableTable
        columns={columns}
        rows={filtered}
        getRowId={(c) => c.id}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onRowClick={(c) => router.push(`/contacts/${c.id}`)}
        initialSort={{ key: "wedding_date", dir: "asc" }}
        emptyState={
          <span className="text-sm text-muted-foreground">
            No contacts match these filters.
          </span>
        }
      />

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleImport}
      />
      <ContactFormSheet open={formOpen} onOpenChange={setFormOpen} />
    </>
  );
}
