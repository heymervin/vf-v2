import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  FileCheck2,
  FileWarning,
  FileMinus2,
  FileX2,
  FileSignature,
  Truck,
  Phone,
  Share2,
  MessageSquare,
  PlusCircle,
  AlertTriangle,
  Camera,
  Music2,
  Cake,
  Car,
  Flower2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  primaryWedding,
  WED_PRIMARY_ID,
  formatLongDate,
  type SupplierStatus,
  type DocStatus,
} from "@/lib/mock";
import { cn } from "@/lib/utils";

export const metadata = { title: "Suppliers" };

// ---------------------------------------------------------------------------
// Status configs
// ---------------------------------------------------------------------------

const SUPPLIER_STATUS: Record<
  SupplierStatus,
  { label: string; variant: "success" | "warning" | "outline" | "secondary" }
> = {
  confirmed: { label: "Confirmed", variant: "success" },
  pending:   { label: "Pending",   variant: "warning" },
  enquired:  { label: "Enquired",  variant: "outline" },
  declined:  { label: "Declined",  variant: "secondary" },
};

const DOC_STATUS: Record<
  DocStatus,
  {
    label: string;
    variant: "success" | "warning" | "outline" | "destructive";
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  }
> = {
  signed:   { label: "Signed",   variant: "success",     icon: FileCheck2 },
  received: { label: "Received", variant: "success",     icon: FileCheck2 },
  sent:     { label: "Sent",     variant: "warning",     icon: FileWarning },
  draft:    { label: "Draft",    variant: "outline",     icon: FileMinus2 },
  missing:  { label: "Missing",  variant: "destructive", icon: FileX2 },
};

// ---------------------------------------------------------------------------
// Document kind config — icons and labels
// ---------------------------------------------------------------------------

type DocKind = "contract" | "insurance" | "invoice" | "supplier" | "other";

const DOC_KIND: Record<
  DocKind,
  { label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; chip: string }
> = {
  contract:  { label: "Contract",  icon: FileSignature, chip: "bg-fun-blue text-foreground" },
  insurance: { label: "Insurance", icon: FileCheck2,    chip: "bg-fun-teal text-foreground" },
  invoice:   { label: "Invoice",   icon: FileText,      chip: "bg-mint text-foreground" },
  supplier:  { label: "Supplier",  icon: Truck,         chip: "bg-accent text-accent-foreground" },
  other:     { label: "Other",     icon: FileText,      chip: "bg-muted text-muted-foreground" },
};

// ---------------------------------------------------------------------------
// Category icons for supplier directory
// ---------------------------------------------------------------------------

const CATEGORY_ICON: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  Florist:          Flower2,
  Photographer:     Camera,
  "Band / DJ":      Music2,
  Cake:             Cake,
  Transport:        Car,
  "Caterer (halal)": Truck,
};

function CategoryIcon({ category }: { category: string }) {
  const Icon = CATEGORY_ICON[category] ?? Truck;
  return <Icon className="size-4" />;
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  bgClass,
  iconClass,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  bgClass: string;
  iconClass: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3 py-1">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", bgClass)}>
          <Icon className={cn("size-4", iconClass)} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
            {value}
          </p>
          {sub && (
            <p className="text-xs text-muted-foreground">{sub}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page (Server Component)
// ---------------------------------------------------------------------------

export default function SuppliersPage() {
  const wedding = primaryWedding();
  const suppliers = wedding.suppliers;
  const docs = wedding.docs;

  // ------ derived stats ------
  const confirmedCount  = suppliers.filter((s) => s.status === "confirmed").length;
  const totalSuppliers  = suppliers.length;
  const pendingCount    = suppliers.filter(
    (s) => s.status === "pending" || s.status === "enquired",
  ).length;

  // Total docs: sum of supplier.docs across all suppliers + wedding-level docs
  const supplierDocsTotal = suppliers.reduce((n, s) => n + s.docs, 0);
  const weddingDocsTotal  = docs.length;
  const docsTotal         = supplierDocsTotal + weddingDocsTotal;

  // "Received" count: received + signed count from wedding.docs
  // (supplier.docs is a count, not statused, so we only count what we can verify)
  const docsReceived = docs.filter(
    (d) => d.status === "signed" || d.status === "received",
  ).length;

  const missingDocs = docs.filter((d) => d.status === "missing");

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Suppliers"
        subtitle={wedding.coupleName}
        actions={
          <Link
            href={`/preview/weddings/${WED_PRIMARY_ID}`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-xs transition-all hover:border-foreground/30 hover:shadow-sm"
          >
            <ArrowLeft className="size-4 shrink-0 text-muted-foreground" />
            Back to workspace
          </Link>
        }
      />

      {/* ------------------------------------------------------------------ */}
      {/* Missing doc alert banner                                             */}
      {/* ------------------------------------------------------------------ */}
      {missingDocs.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/8 px-4 py-3.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {missingDocs.length === 1
                ? "1 document is missing"
                : `${missingDocs.length} documents are missing`}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {missingDocs.map((d) => d.name).join(", ")} —{" "}
              <span className="text-foreground">action required before the wedding.</span>
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Summary stat row                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Confirmed"
          value={`${confirmedCount} / ${totalSuppliers}`}
          sub="suppliers"
          bgClass="bg-fun-green"
          iconClass="text-fun-green-strong"
          icon={CheckCircle2}
        />
        <StatCard
          label="Pending / Enquired"
          value={pendingCount}
          sub="still to confirm"
          bgClass="bg-warning"
          iconClass="text-warning-foreground"
          icon={Clock}
        />
        <StatCard
          label="Documents received"
          value={`${docsReceived} / ${docsTotal}`}
          sub="across all suppliers"
          bgClass="bg-fun-blue"
          iconClass="text-fun-blue-strong"
          icon={FileCheck2}
        />
        <StatCard
          label="Missing docs"
          value={missingDocs.length}
          sub={missingDocs.length === 0 ? "all good" : "need chasing"}
          bgClass={missingDocs.length > 0 ? "bg-destructive/10" : "bg-fun-green"}
          iconClass={missingDocs.length > 0 ? "text-destructive" : "text-fun-green-strong"}
          icon={missingDocs.length > 0 ? FileX2 : FileCheck2}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Supplier directory                                                   */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Supplier directory
            </p>
            <h2 className="text-base font-semibold text-foreground">
              {totalSuppliers} suppliers on this wedding
            </h2>
          </div>
          <Button variant="default" size="sm" className="min-h-[44px]">
            <PlusCircle className="size-4" />
            Add supplier
          </Button>
        </div>

        {/* Mobile: cards / Desktop: table-style rows */}
        <Card>
          {/* Table header — hidden on mobile */}
          <div className="hidden border-b border-border px-6 py-3 sm:grid sm:grid-cols-[2fr_1.5fr_1.5fr_1fr_1fr_auto] sm:items-center sm:gap-4">
            {["Supplier", "Contact", "Phone", "Status", "Arrival", ""].map((h) => (
              <span
                key={h}
                className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              >
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-border">
            {suppliers.length === 0 ? (
              <div className="flex flex-col items-center py-14 text-center">
                <Truck className="mb-3 size-10 text-muted-foreground/30" />
                <p className="text-sm font-semibold text-foreground">No suppliers added yet</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Add your florist, photographer, band and any other vendors here so
                  their documents and arrival times stay in one place.
                </p>
              </div>
            ) : (
              suppliers.map((supplier) => {
                const status = SUPPLIER_STATUS[supplier.status];
                return (
                  <div
                    key={supplier.id}
                    className="group grid grid-cols-1 gap-y-3 px-6 py-4 transition-colors hover:bg-accent/40 sm:grid-cols-[2fr_1.5fr_1.5fr_1fr_1fr_auto] sm:items-center sm:gap-4 sm:py-3.5"
                  >
                    {/* Name + category */}
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                        <CategoryIcon category={supplier.category} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {supplier.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{supplier.category}</p>
                      </div>
                    </div>

                    {/* Contact name */}
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:hidden">
                        Contact
                      </p>
                      <p className="text-sm text-foreground">{supplier.contactName}</p>
                    </div>

                    {/* Phone */}
                    <div className="flex items-center gap-1.5">
                      <Phone className="size-3.5 shrink-0 text-muted-foreground sm:hidden" />
                      <a
                        href={`tel:${supplier.phone}`}
                        className="text-sm text-foreground hover:text-primary hover:underline tabular-nums"
                      >
                        {supplier.phone}
                      </a>
                    </div>

                    {/* Status badge */}
                    <div>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>

                    {/* Arrival time */}
                    <div>
                      {supplier.arrivalTime ? (
                        <span className="text-sm font-medium tabular-nums text-foreground">
                          {supplier.arrivalTime}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 sm:justify-end">
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs min-h-[44px] sm:min-h-0">
                        <Share2 className="size-3.5" />
                        <span className="sm:hidden lg:inline">Share run-sheet</span>
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs min-h-[44px] sm:min-h-0">
                        <MessageSquare className="size-3.5" />
                        <span className="sm:hidden lg:inline">Message</span>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Document hub                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Document hub
            </p>
            <h2 className="text-base font-semibold text-foreground">
              {docs.length} document{docs.length !== 1 ? "s" : ""} on this wedding
            </h2>
          </div>
          <Button variant="outline" size="sm" className="min-h-[44px]">
            <PlusCircle className="size-4" />
            Request document
          </Button>
        </div>

        <div className="space-y-3">
          {docs.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-border bg-card py-14 text-center shadow-xs">
              <FileText className="mb-3 size-10 text-muted-foreground/30" />
              <p className="text-sm font-semibold text-foreground">No documents yet</p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Upload or request contracts, insurance certificates and invoices
                here to keep everything in one place.
              </p>
            </div>
          ) : (
            docs.map((doc) => {
              const kind    = DOC_KIND[doc.kind];
              const status  = DOC_STATUS[doc.status];
              const KindIcon   = kind.icon;
              const StatusIcon = status.icon;
              const isMissing  = doc.status === "missing";

              return (
                <div
                  key={doc.id}
                  className={cn(
                    "flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border bg-card px-5 py-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md",
                    isMissing
                      ? "border-destructive/40 bg-destructive/5"
                      : "border-border",
                  )}
                >
                  {/* Kind icon + name */}
                  <div className="flex flex-1 items-center gap-3 min-w-0">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        kind.chip,
                      )}
                    >
                      <KindIcon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {doc.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Updated {formatLongDate(doc.updatedAt)}
                      </p>
                    </div>
                  </div>

                  {/* Kind chip */}
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em]",
                      kind.chip,
                    )}
                  >
                    {kind.label}
                  </span>

                  {/* Status badge */}
                  <Badge variant={status.variant} className="gap-1">
                    <StatusIcon />
                    {status.label}
                  </Badge>

                  {/* Missing doc: action nudge */}
                  {isMissing && (
                    <Button variant="default" size="sm" className="ml-auto min-h-[44px] sm:min-h-0">
                      <PlusCircle className="size-3.5" />
                      Request now
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Docs legend footnote */}
        {docs.length > 0 && (
          <p className="mt-4 text-xs text-muted-foreground">
            Document counts above include{" "}
            <span className="font-medium tabular-nums text-foreground">{supplierDocsTotal}</span>{" "}
            supplier-uploaded file{supplierDocsTotal !== 1 ? "s" : ""} and{" "}
            <span className="font-medium tabular-nums text-foreground">{weddingDocsTotal}</span>{" "}
            venue document{weddingDocsTotal !== 1 ? "s" : ""}.
          </p>
        )}
      </section>
    </div>
  );
}
