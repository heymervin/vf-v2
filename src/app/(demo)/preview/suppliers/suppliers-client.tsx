"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Camera,
  Car,
  ChevronDown,
  ChevronRight,
  Cake,
  Clock,
  ExternalLink,
  FileText,
  Flower2,
  Globe,
  Mail,
  Music2,
  Phone,
  PlusCircle,
  ShieldAlert,
  ShieldCheck,
  Star,
  Truck,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { DataToolbar } from "@/components/data-toolbar"
import { SupplierStatusBadge, DocStatusBadge } from "@/components/status-badges"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  type Supplier,
  type SupplierStatus,
  type WeddingDoc,
  type PreferredSupplier,
  TODAY,
  formatLongDate,
  daysFromToday,
  WED_PRIMARY_ID,
} from "@/lib/mock"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SuppliersClientProps {
  suppliers: Supplier[]
  docs: WeddingDoc[]
  coupleName: string
  preferredSuppliers: PreferredSupplier[]
}

// ---------------------------------------------------------------------------
// Category icon map
// ---------------------------------------------------------------------------

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Florist: Flower2,
  Photographer: Camera,
  "Band / DJ": Music2,
  Cake: Cake,
  Transport: Car,
  "Caterer (halal)": Truck,
  Caterer: Truck,
  Stylist: Users,
  Toastmaster: Users,
}

function CategoryIcon({ category }: { category: string }) {
  const Icon = CATEGORY_ICON[category] ?? Truck
  return <Icon className="size-4" />
}

// ---------------------------------------------------------------------------
// Expiry helpers
// ---------------------------------------------------------------------------

function getExpiryWarning(expiryDate: string | null | undefined): {
  level: "expired" | "warning" | null
  daysLeft: number | null
} {
  if (!expiryDate) return { level: null, daysLeft: null }
  const days = daysFromToday(expiryDate)
  if (days < 0) return { level: "expired", daysLeft: days }
  if (days < 60) return { level: "warning", daysLeft: days }
  return { level: null, daysLeft: days }
}

// ---------------------------------------------------------------------------
// Stat mini-card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  bgClass,
  iconClass,
  icon: Icon,
}: {
  label: string
  value: string | number
  sub?: string
  bgClass: string
  iconClass: string
  icon: React.ComponentType<{ className?: string }>
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
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Expiry warning chip
// ---------------------------------------------------------------------------

function ExpiryChip({ expiryDate }: { expiryDate: string | null | undefined }) {
  const { level, daysLeft } = getExpiryWarning(expiryDate)
  if (!level) return null

  if (level === "expired") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className="gap-1 cursor-default">
              <ShieldAlert className="size-3 shrink-0" />
              Expired
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Insurance expired {Math.abs(daysLeft!)} day{Math.abs(daysLeft!) !== 1 ? "s" : ""} ago</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="warning" className="gap-1 cursor-default">
            <ShieldAlert className="size-3 shrink-0" />
            Expires in {daysLeft}d
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Expires {formatLongDate(expiryDate!)} — within 60-day warning window</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ---------------------------------------------------------------------------
// Filter chip toggle button
// ---------------------------------------------------------------------------

function FilterChip({
  label,
  active,
  count,
  onToggle,
}: {
  label: string
  active: boolean
  count?: number
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors min-h-[32px]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:border-foreground/30 hover:bg-accent/50",
      )}
    >
      {label}
      {count !== undefined && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
            active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Expandable supplier row (Compliance tab)
// ---------------------------------------------------------------------------

function SupplierComplianceRow({
  supplier,
  supplierDocs,
}: {
  supplier: Supplier
  supplierDocs: WeddingDoc[]
}) {
  const [expanded, setExpanded] = React.useState(false)
  const hasInsuranceExpiry = supplierDocs.some((d) => d.kind === "insurance" && d.expiryDate)
  const worstExpiry = supplierDocs
    .filter((d) => d.kind === "insurance" && d.expiryDate)
    .map((d) => getExpiryWarning(d.expiryDate))
    .find((w) => w.level !== null)

  return (
    <div className="border-b border-border last:border-0">
      {/* Main row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "w-full text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          "min-h-[56px]",
        )}
        aria-expanded={expanded}
        aria-label={`${supplier.name} — ${expanded ? "collapse" : "expand"} documents`}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 sm:grid sm:grid-cols-[auto_2fr_1.5fr_1fr_1fr_1fr_auto] sm:items-center sm:gap-4">
          {/* Expand icon */}
          <span className="text-muted-foreground">
            {expanded ? (
              <ChevronDown className="size-4 shrink-0" />
            ) : (
              <ChevronRight className="size-4 shrink-0" />
            )}
          </span>

          {/* Name + category */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <CategoryIcon category={supplier.category} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{supplier.name}</p>
              <p className="text-xs text-muted-foreground">{supplier.category}</p>
            </div>
          </div>

          {/* Contact */}
          <div className="hidden sm:block">
            <p className="text-sm text-foreground">{supplier.contactName}</p>
            {supplier.email && (
              <p className="truncate text-xs text-muted-foreground">{supplier.email}</p>
            )}
          </div>

          {/* Status */}
          <div>
            <SupplierStatusBadge status={supplier.status as SupplierStatus} />
          </div>

          {/* Doc count */}
          <div className="hidden sm:block">
            <span className="tabular-nums text-sm text-foreground">
              {supplierDocs.length} doc{supplierDocs.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Expiry warning */}
          <div className="hidden sm:block">
            {worstExpiry?.level ? (
              <ExpiryChip expiryDate={
                supplierDocs.find((d) => d.kind === "insurance" && d.expiryDate)?.expiryDate
              } />
            ) : hasInsuranceExpiry ? (
              <Badge variant="success" className="gap-1">
                <ShieldCheck className="size-3" />
                Valid
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>

          {/* Quick contact */}
          <div className="flex items-center gap-1.5 sm:justify-end" onClick={(e) => e.stopPropagation()}>
            {supplier.phone && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={`tel:${supplier.phone}`}
                      className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Call ${supplier.contactName}`}
                    >
                      <Phone className="size-4" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Call {supplier.phone}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {supplier.email && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={`mailto:${supplier.email}`}
                      className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Email ${supplier.contactName}`}
                    >
                      <Mail className="size-4" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Email {supplier.email}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </button>

      {/* Expanded: linked docs */}
      {expanded && (
        <div className="border-t border-border/60 bg-muted/30 px-5 py-3">
          {supplierDocs.length === 0 ? (
            <div className="flex items-center gap-2 py-2">
              <FileText className="size-4 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No documents linked to this supplier yet.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto min-h-[40px]"
                onClick={() =>
                  toast.success("Document request sent", {
                    description: `Chasing ${supplier.contactName} at ${supplier.name} for their documents.`,
                  })
                }
              >
                <PlusCircle className="size-3.5" />
                Request doc
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {supplierDocs.map((doc) => {
                const expiry = getExpiryWarning(doc.expiryDate)
                const isMissing = doc.status === "missing"
                return (
                  <div
                    key={doc.id}
                    className={cn(
                      "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-2.5 text-sm",
                      isMissing
                        ? "border-destructive/30 bg-destructive/5"
                        : expiry.level === "expired"
                          ? "border-destructive/30 bg-destructive/5"
                          : expiry.level === "warning"
                            ? "border-warning/40 bg-warning/10"
                            : "border-border bg-card",
                    )}
                  >
                    {/* Name */}
                    <div className="flex flex-1 items-center gap-2 min-w-0">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium text-foreground">{doc.name}</span>
                    </div>

                    {/* Kind chip */}
                    <span className="text-xs text-muted-foreground capitalize">
                      {doc.kind}
                    </span>

                    {/* Status badge */}
                    <DocStatusBadge status={doc.status} />

                    {/* Expiry */}
                    {doc.expiryDate && (
                      <div className="flex items-center gap-1.5">
                        {expiry.level ? (
                          <ExpiryChip expiryDate={doc.expiryDate} />
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="size-3" />
                            Expires {formatLongDate(doc.expiryDate)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Updated */}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      Updated {formatLongDate(doc.updatedAt)}
                    </span>

                    {/* Missing action */}
                    {isMissing && (
                      <Button
                        variant="default"
                        size="sm"
                        className="ml-auto min-h-[36px]"
                        onClick={() =>
                          toast.success("Request sent", {
                            description: `Chasing ${supplier.contactName} for "${doc.name}".`,
                          })
                        }
                      >
                        <PlusCircle className="size-3.5" />
                        Request now
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Event-day arrivals row
// ---------------------------------------------------------------------------

function ArrivalRow({ supplier }: { supplier: Supplier }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 min-h-[56px] border-b border-border last:border-0 transition-colors hover:bg-accent/40 sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-center sm:gap-4">
      {/* Name */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <CategoryIcon category={supplier.category} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{supplier.name}</p>
          <p className="text-xs text-muted-foreground">{supplier.contactName}</p>
        </div>
      </div>

      {/* Arrival time */}
      <div>
        {supplier.arrivalTime ? (
          <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-foreground">
            <Clock className="size-3.5 text-muted-foreground" />
            {supplier.arrivalTime}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">TBC</span>
        )}
      </div>

      {/* Status */}
      <div>
        <SupplierStatusBadge status={supplier.status as SupplierStatus} />
      </div>

      {/* Checked in */}
      <div className="hidden sm:block">
        {supplier.checkedInAt ? (
          <Badge variant="success" className="gap-1">
            <ShieldCheck className="size-3" />
            Checked in
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Not yet</span>
        )}
      </div>

      {/* Quick contact */}
      <div className="flex items-center gap-1.5 sm:justify-end">
        {supplier.phone && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={`tel:${supplier.phone}`}
                  className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Call ${supplier.contactName}`}
                >
                  <Phone className="size-4" />
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <p>Call {supplier.phone}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {supplier.email && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={`mailto:${supplier.email}`}
                  className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Email ${supplier.contactName}`}
                >
                  <Mail className="size-4" />
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <p>Email {supplier.email}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Preferred supplier card
// ---------------------------------------------------------------------------

function PreferredSupplierCard({
  ps,
  alreadyOnWedding,
  onAdd,
}: {
  ps: PreferredSupplier
  alreadyOnWedding: boolean
  onAdd: (ps: PreferredSupplier) => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <CategoryIcon category={ps.category} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{ps.name}</p>
            {ps.venueApproved && (
              <Badge variant="success" className="gap-1 text-[10px]">
                <ShieldCheck className="size-2.5" />
                Approved
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{ps.category}</p>
        </div>
        {ps.avgRating && (
          <span className="flex items-center gap-1 text-xs font-medium tabular-nums text-warning-foreground">
            <Star className="size-3 fill-current" />
            {ps.avgRating.toFixed(1)}
          </span>
        )}
      </div>

      {/* Notes */}
      {ps.notes && (
        <p className="text-xs text-muted-foreground line-clamp-2">{ps.notes}</p>
      )}

      {/* Footer actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
        {/* Contact quick-links */}
        <a
          href={`tel:${ps.phone}`}
          className="flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Phone className="size-3.5" />
          {ps.phone}
        </a>
        <a
          href={`mailto:${ps.email}`}
          className="flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Mail className="size-3.5" />
          <span className="truncate max-w-[140px]">{ps.email}</span>
        </a>
        {ps.website && (
          <a
            href={ps.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Visit ${ps.name} website`}
          >
            <Globe className="size-3.5" />
            <ExternalLink className="size-3" />
          </a>
        )}
        <div className="ml-auto">
          {alreadyOnWedding ? (
            <Badge variant="success" className="gap-1">
              <ShieldCheck className="size-3" />
              On this wedding
            </Badge>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="min-h-[36px] gap-1.5"
              onClick={() => onAdd(ps)}
            >
              <PlusCircle className="size-3.5" />
              Add to wedding
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function SuppliersClient({
  suppliers: initialSuppliers,
  docs,
  coupleName,
  preferredSuppliers,
}: SuppliersClientProps) {
  // ── Filter state ───────────────────────────────────────────────────────────
  const [search, setSearch] = React.useState("")
  const [activeStatuses, setActiveStatuses] = React.useState<Set<SupplierStatus>>(new Set())
  const [activeCategories, setActiveCategories] = React.useState<Set<string>>(new Set())

  // ── Preferred supplier directory filter state ──────────────────────────────
  const [prefSearch, setPrefSearch] = React.useState("")
  const [prefCategory, setPrefCategory] = React.useState<string | null>(null)

  // ── Optimistic: "added" preferred suppliers ───────────────────────────────
  const [addedToWedding, setAddedToWedding] = React.useState<Set<string>>(new Set())

  // ── Derive which suppliers are already on this wedding ────────────────────
  const weddingSupplierNames = React.useMemo(
    () => new Set(initialSuppliers.map((s) => s.name.toLowerCase())),
    [initialSuppliers],
  )

  // ── Build map: supplierId → docs ──────────────────────────────────────────
  const docsBySupplier = React.useMemo(() => {
    const map = new Map<string, WeddingDoc[]>()
    for (const doc of docs) {
      if (doc.supplierId) {
        const existing = map.get(doc.supplierId) ?? []
        map.set(doc.supplierId, [...existing, doc])
      }
    }
    return map
  }, [docs])

  // Docs not linked to any supplier (wedding-level docs)
  const unlinkedDocs = React.useMemo(
    () => docs.filter((d) => !d.supplierId),
    [docs],
  )

  // ── Derived stats ──────────────────────────────────────────────────────────
  const confirmedCount = initialSuppliers.filter((s) => s.status === "confirmed").length
  const pendingCount = initialSuppliers.filter(
    (s) => s.status === "pending" || s.status === "enquired",
  ).length
  const missingDocs = docs.filter((d) => d.status === "missing")
  const expiryWarnings = docs.filter(
    (d) => d.kind === "insurance" && getExpiryWarning(d.expiryDate).level !== null,
  )

  // ── Filter suppliers ───────────────────────────────────────────────────────
  const allCategories = React.useMemo(
    () => [...new Set(initialSuppliers.map((s) => s.category))],
    [initialSuppliers],
  )

  const allStatuses: SupplierStatus[] = ["confirmed", "pending", "enquired", "declined"]

  const filteredSuppliers = React.useMemo(() => {
    return initialSuppliers.filter((s) => {
      const q = search.toLowerCase()
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.contactName.toLowerCase().includes(q)
      const matchesStatus =
        activeStatuses.size === 0 || activeStatuses.has(s.status)
      const matchesCategory =
        activeCategories.size === 0 || activeCategories.has(s.category)
      return matchesSearch && matchesStatus && matchesCategory
    })
  }, [initialSuppliers, search, activeStatuses, activeCategories])

  // Sorted arrivals: confirmed + pending first, then by arrival time
  const sortedByArrival = React.useMemo(() => {
    return [...filteredSuppliers].sort((a, b) => {
      if (!a.arrivalTime && !b.arrivalTime) return 0
      if (!a.arrivalTime) return 1
      if (!b.arrivalTime) return -1
      return a.arrivalTime.localeCompare(b.arrivalTime)
    })
  }, [filteredSuppliers])

  // ── Filter preferred suppliers ─────────────────────────────────────────────
  const prefCategories = React.useMemo(
    () => [...new Set(preferredSuppliers.map((p) => p.category))],
    [preferredSuppliers],
  )

  const filteredPreferred = React.useMemo(() => {
    return preferredSuppliers.filter((p) => {
      const q = prefSearch.toLowerCase()
      const matchesSearch =
        !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
      const matchesCategory = !prefCategory || p.category === prefCategory
      return matchesSearch && matchesCategory
    })
  }, [preferredSuppliers, prefSearch, prefCategory])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const toggleStatus = (status: SupplierStatus) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  const toggleCategory = (cat: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const handleAddToWedding = (ps: PreferredSupplier) => {
    setAddedToWedding((prev) => new Set([...prev, ps.id]))
    toast.success(`${ps.name} added to ${coupleName}`, {
      description: `${ps.contactName} · ${ps.category} — you can now log their docs and arrival time.`,
    })
  }

  const hasFilters = activeStatuses.size > 0 || activeCategories.size > 0 || search

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Suppliers"
        subtitle={coupleName}
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

      {/* ── Alert banners ─────────────────────────────────────────────────── */}
      <div className="mb-6 space-y-2">
        {missingDocs.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/8 px-4 py-3.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {missingDocs.length === 1
                  ? "1 document missing"
                  : `${missingDocs.length} documents missing`}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {missingDocs.map((d) => d.name).join(", ")} — action required before the wedding.
              </p>
            </div>
          </div>
        )}
        {expiryWarnings.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3.5">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {expiryWarnings.length === 1
                  ? "1 insurance certificate needs attention"
                  : `${expiryWarnings.length} insurance certificates need attention`}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {expiryWarnings
                  .map((d) => {
                    const w = getExpiryWarning(d.expiryDate)
                    return w.level === "expired"
                      ? `${d.name} (expired)`
                      : `${d.name} (expires in ${w.daysLeft}d)`
                  })
                  .join(", ")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Stats strip ───────────────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Confirmed"
          value={`${confirmedCount} / ${initialSuppliers.length}`}
          sub="suppliers"
          bgClass="bg-fun-green"
          iconClass="text-fun-green-strong"
          icon={ShieldCheck}
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
          label="Missing docs"
          value={missingDocs.length}
          sub={missingDocs.length === 0 ? "all good" : "need chasing"}
          bgClass={missingDocs.length > 0 ? "bg-destructive/10" : "bg-fun-green"}
          iconClass={missingDocs.length > 0 ? "text-destructive" : "text-fun-green-strong"}
          icon={missingDocs.length > 0 ? AlertTriangle : ShieldCheck}
        />
        <StatCard
          label="Insurance expiries"
          value={expiryWarnings.length}
          sub={expiryWarnings.length === 0 ? "all current" : "require action"}
          bgClass={expiryWarnings.length > 0 ? "bg-warning/20" : "bg-fun-green"}
          iconClass={expiryWarnings.length > 0 ? "text-warning-foreground" : "text-fun-green-strong"}
          icon={ShieldAlert}
        />
      </div>

      {/* ── Main content: tabs ────────────────────────────────────────────── */}
      <Tabs defaultValue="compliance" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="compliance" className="gap-1.5">
              Compliance
              <Badge variant="secondary" className="tabular-nums text-[10px] px-1.5 py-0">
                {initialSuppliers.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="arrivals" className="gap-1.5">
              Event-day arrivals
              <Badge variant="secondary" className="tabular-nums text-[10px] px-1.5 py-0">
                {initialSuppliers.filter((s) => s.arrivalTime).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="directory">
              Preferred directory
              <Badge variant="secondary" className="tabular-nums text-[10px] px-1.5 ml-1.5 py-0">
                {preferredSuppliers.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
          <Button
            variant="default"
            size="sm"
            className="min-h-[44px]"
            onClick={() =>
              toast.success("Supplier added", {
                description: "Fill in their details and request documents via the row menu.",
              })
            }
          >
            <PlusCircle className="size-4" />
            Add supplier
          </Button>
        </div>

        {/* ── Compliance tab ──────────────────────────────────────────────── */}
        <TabsContent value="compliance" className="space-y-4">
          <DataToolbar
            search={{
              value: search,
              onChange: setSearch,
              placeholder: "Search suppliers…",
            }}
            resultCount={filteredSuppliers.length}
            totalCount={initialSuppliers.length}
          >
            {/* Status filter chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Status:
              </span>
              {allStatuses.map((status) => {
                const count = initialSuppliers.filter((s) => s.status === status).length
                if (count === 0) return null
                return (
                  <FilterChip
                    key={status}
                    label={status.charAt(0).toUpperCase() + status.slice(1)}
                    active={activeStatuses.has(status)}
                    count={count}
                    onToggle={() => toggleStatus(status)}
                  />
                )
              })}
              {allCategories.length > 1 && (
                <>
                  <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Category:
                  </span>
                  {allCategories.map((cat) => (
                    <FilterChip
                      key={cat}
                      label={cat}
                      active={activeCategories.has(cat)}
                      onToggle={() => toggleCategory(cat)}
                    />
                  ))}
                </>
              )}
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("")
                    setActiveStatuses(new Set())
                    setActiveCategories(new Set())
                  }}
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-3" />
                  Clear all
                </button>
              )}
            </div>
          </DataToolbar>

          {/* Supplier rows with expandable docs */}
          <Card className="overflow-hidden">
            {/* Table header */}
            <div className="hidden border-b border-border px-5 py-3 sm:grid sm:grid-cols-[auto_2fr_1.5fr_1fr_1fr_1fr_auto] sm:items-center sm:gap-4">
              {["", "Supplier", "Contact", "Status", "Docs", "Insurance", ""].map((h, i) => (
                <span
                  key={i}
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  {h}
                </span>
              ))}
            </div>

            {filteredSuppliers.length === 0 ? (
              <div className="flex flex-col items-center py-14 text-center">
                <Truck className="mb-3 size-10 text-muted-foreground/30" />
                <p className="text-sm font-semibold text-foreground">No suppliers match your filters</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Try clearing the status or category filters.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 min-h-[44px]"
                  onClick={() => {
                    setSearch("")
                    setActiveStatuses(new Set())
                    setActiveCategories(new Set())
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              filteredSuppliers.map((supplier) => (
                <SupplierComplianceRow
                  key={supplier.id}
                  supplier={supplier}
                  supplierDocs={docsBySupplier.get(supplier.id) ?? []}
                />
              ))
            )}
          </Card>

          {/* Unlinked (wedding-level) docs */}
          {unlinkedDocs.length > 0 && (
            <section>
              <div className="mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Wedding-level documents
                </p>
                <p className="text-sm text-muted-foreground">
                  {unlinkedDocs.length} document{unlinkedDocs.length !== 1 ? "s" : ""} not linked to a specific supplier
                </p>
              </div>
              <div className="space-y-2">
                {unlinkedDocs.map((doc) => {
                  const isMissing = doc.status === "missing"
                  const expiry = getExpiryWarning(doc.expiryDate)
                  return (
                    <div
                      key={doc.id}
                      className={cn(
                        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-5 py-3.5 text-sm shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md",
                        isMissing ? "border-destructive/40 bg-destructive/5" : "border-border bg-card",
                      )}
                    >
                      <div className="flex flex-1 items-center gap-2.5 min-w-0">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium text-foreground">{doc.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">{doc.kind}</span>
                      <DocStatusBadge status={doc.status} />
                      {doc.expiryDate && expiry.level && <ExpiryChip expiryDate={doc.expiryDate} />}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        Updated {formatLongDate(doc.updatedAt)}
                      </span>
                      {isMissing && (
                        <Button
                          variant="default"
                          size="sm"
                          className="ml-auto min-h-[36px]"
                          onClick={() =>
                            toast.success("Request sent", {
                              description: `Chasing "${doc.name}" document.`,
                            })
                          }
                        >
                          <PlusCircle className="size-3.5" />
                          Request now
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </TabsContent>

        {/* ── Event-day arrivals tab ──────────────────────────────────────── */}
        <TabsContent value="arrivals" className="space-y-4">
          <DataToolbar
            search={{
              value: search,
              onChange: setSearch,
              placeholder: "Search suppliers…",
            }}
            resultCount={filteredSuppliers.length}
            totalCount={initialSuppliers.length}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Status:
              </span>
              {allStatuses.map((status) => {
                const count = initialSuppliers.filter((s) => s.status === status).length
                if (count === 0) return null
                return (
                  <FilterChip
                    key={status}
                    label={status.charAt(0).toUpperCase() + status.slice(1)}
                    active={activeStatuses.has(status)}
                    count={count}
                    onToggle={() => toggleStatus(status)}
                  />
                )
              })}
            </div>
          </DataToolbar>

          <Card className="overflow-hidden">
            {/* Table header */}
            <div className="hidden border-b border-border px-5 py-3 sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-center sm:gap-4">
              {["Supplier", "Arrival time", "Status", "Check-in", ""].map((h, i) => (
                <span
                  key={i}
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  {h}
                </span>
              ))}
            </div>

            {sortedByArrival.length === 0 ? (
              <div className="flex flex-col items-center py-14 text-center">
                <Clock className="mb-3 size-10 text-muted-foreground/30" />
                <p className="text-sm font-semibold text-foreground">No suppliers match your filters</p>
              </div>
            ) : (
              sortedByArrival.map((supplier) => (
                <ArrivalRow key={supplier.id} supplier={supplier} />
              ))
            )}
          </Card>

          {/* Hint */}
          <p className="text-xs text-muted-foreground">
            Arrival times sorted chronologically. Tap the phone icon for one-tap call on event day.
            Suppliers without a confirmed arrival time appear at the end.
          </p>
        </TabsContent>

        {/* ── Preferred directory tab ────────────────────────────────────── */}
        <TabsContent value="directory" className="space-y-4">
          <DataToolbar
            search={{
              value: prefSearch,
              onChange: setPrefSearch,
              placeholder: "Search preferred suppliers…",
            }}
            resultCount={filteredPreferred.length}
            totalCount={preferredSuppliers.length}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Category:
              </span>
              {prefCategories.map((cat) => (
                <FilterChip
                  key={cat}
                  label={cat}
                  active={prefCategory === cat}
                  count={preferredSuppliers.filter((p) => p.category === cat).length}
                  onToggle={() => setPrefCategory((prev) => (prev === cat ? null : cat))}
                />
              ))}
            </div>
          </DataToolbar>

          {filteredPreferred.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-border bg-card py-14 text-center shadow-xs">
              <Users className="mb-3 size-10 text-muted-foreground/30" />
              <p className="text-sm font-semibold text-foreground">No preferred suppliers found</p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Try a different search or category filter.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPreferred.map((ps) => (
                <PreferredSupplierCard
                  key={ps.id}
                  ps={ps}
                  alreadyOnWedding={
                    weddingSupplierNames.has(ps.name.toLowerCase()) ||
                    addedToWedding.has(ps.id)
                  }
                  onAdd={handleAddToWedding}
                />
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {preferredSuppliers.filter((p) => p.venueApproved).length} venue-approved
            </span>{" "}
            of {preferredSuppliers.length} suppliers in the directory.
            Approved suppliers have valid PLI on file with The Old Barn.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
