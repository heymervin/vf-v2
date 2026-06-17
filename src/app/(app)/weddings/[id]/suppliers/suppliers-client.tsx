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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  attachSupplierFromDirectory,
  attachAdHocSupplier,
  updateWeddingSupplier,
  checkInWeddingSupplier,
  removeWeddingSupplier,
  chaseMissingDoc,
  type WeddingSupplierRow,
  type DirectorySupplierRow,
  type WeddingDocumentRow,
} from "./actions"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SupplierStatus = "confirmed" | "pending" | "enquired" | "declined"
type DocStatus = "signed" | "received" | "sent" | "draft" | "missing"

// Derive doc status from the DB row (no status column in schema)
function deriveDocStatus(doc: WeddingDocumentRow): DocStatus {
  if (doc.signed_at) return "signed"
  if (doc.storage_path && doc.storage_path !== "") return "received"
  return "missing"
}

export interface SuppliersClientProps {
  weddingId: string
  coupleName: string
  suppliers: WeddingSupplierRow[]
  documents: WeddingDocumentRow[]
  directorySuppliers: DirectorySupplierRow[]
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

function daysFromNow(isoDate: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const d = new Date(isoDate)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - now.getTime()) / 86_400_000)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function getExpiryWarning(expiryDate: string | null | undefined): {
  level: "expired" | "warning" | null
  daysLeft: number | null
} {
  if (!expiryDate) return { level: null, daysLeft: null }
  const days = daysFromNow(expiryDate)
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
          <p>Expires {formatDate(expiryDate!)} — within 60-day warning window</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ---------------------------------------------------------------------------
// Filter chip
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
// Add supplier sheet
// ---------------------------------------------------------------------------

function AddSupplierSheet({
  weddingId,
  open,
  onOpenChange,
  onAdded,
}: {
  weddingId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onAdded: (row: WeddingSupplierRow) => void
}) {
  const [name, setName] = React.useState("")
  const [category, setCategory] = React.useState("")
  const [contactName, setContactName] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [pending, setPending] = React.useState(false)

  const reset = () => {
    setName(""); setCategory(""); setContactName("")
    setPhone(""); setEmail(""); setNotes("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !category.trim()) return
    setPending(true)
    try {
      const result = await attachAdHocSupplier({
        weddingId,
        name: name.trim(),
        category: category.trim(),
        contactName: contactName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      onAdded(result.data)
      toast.success(`${name} added to wedding`)
      onOpenChange(false)
      reset()
    } finally {
      setPending(false)
    }
  }

  const COMMON_CATEGORIES = [
    "Photographer", "Videographer", "Florist", "Band / DJ", "Cake",
    "Caterer", "Transport", "Stylist", "Toastmaster", "Hair & Make-up",
    "Venue dressing", "Entertainment", "Other",
  ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add supplier</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sup-name">Name *</Label>
            <Input
              id="sup-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bloom & Wild Co."
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sup-category">Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="sup-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sup-contact">Contact name</Label>
            <Input
              id="sup-contact"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="e.g. Jess Allen"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sup-phone">Phone</Label>
              <Input
                id="sup-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+44 7700 900000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-email">Email</Label>
              <Input
                id="sup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hello@supplier.co.uk"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sup-notes">Notes</Label>
            <Input
              id="sup-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any details for the team…"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={pending || !name.trim() || !category.trim()}
              className="flex-1 min-h-[44px]"
            >
              {pending ? "Adding…" : "Add supplier"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => { onOpenChange(false); reset() }}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Expandable compliance row (Compliance tab)
// ---------------------------------------------------------------------------

function SupplierComplianceRow({
  supplier,
  supplierDocs,
  weddingId,
  onChase,
  onRemove,
}: {
  supplier: WeddingSupplierRow
  supplierDocs: WeddingDocumentRow[]
  weddingId: string
  onChase: (docId: string) => void
  onRemove: (rowId: string) => void
}) {
  const [expanded, setExpanded] = React.useState(false)

  const insuranceDocs = supplierDocs.filter(
    (d) => d.kind === "insurance" && d.expiry_date,
  )
  const hasInsuranceExpiry = insuranceDocs.length > 0
  const worstExpiry = insuranceDocs
    .map((d) => getExpiryWarning(d.expiry_date))
    .find((w) => w.level !== null)

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "w-full text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          "min-h-[56px]",
        )}
        aria-expanded={expanded}
        aria-label={`${supplier.name} — ${expanded ? "collapse" : "expand"} details`}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 sm:grid sm:grid-cols-[auto_2fr_1.5fr_1fr_1fr_1fr_auto] sm:items-center sm:gap-4">
          <span className="text-muted-foreground">
            {expanded ? (
              <ChevronDown className="size-4 shrink-0" />
            ) : (
              <ChevronRight className="size-4 shrink-0" />
            )}
          </span>

          <div className="flex items-center gap-3 min-w-0">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <CategoryIcon category={supplier.category} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{supplier.name}</p>
              <p className="text-xs text-muted-foreground">{supplier.category}</p>
            </div>
          </div>

          <div className="hidden sm:block">
            <p className="text-sm text-foreground">{supplier.contact_name ?? "—"}</p>
            {supplier.email && (
              <p className="truncate text-xs text-muted-foreground">{supplier.email}</p>
            )}
          </div>

          <div>
            <SupplierStatusBadge status={supplier.status as SupplierStatus} />
          </div>

          <div className="hidden sm:block">
            <span className="tabular-nums text-sm text-foreground">
              {supplierDocs.length} doc{supplierDocs.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="hidden sm:block">
            {worstExpiry?.level ? (
              <ExpiryChip expiryDate={insuranceDocs[0]?.expiry_date} />
            ) : hasInsuranceExpiry ? (
              <Badge variant="success" className="gap-1">
                <ShieldCheck className="size-3" />
                Valid
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:justify-end" onClick={(e) => e.stopPropagation()}>
            {supplier.phone && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={`tel:${supplier.phone}`}
                      className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Call ${supplier.contact_name ?? supplier.name}`}
                    >
                      <Phone className="size-4" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent><p>Call {supplier.phone}</p></TooltipContent>
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
                      aria-label={`Email ${supplier.contact_name ?? supplier.name}`}
                    >
                      <Mail className="size-4" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent><p>Email {supplier.email}</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/60 bg-muted/30 px-5 py-3 space-y-3">
          {/* Status update */}
          <StatusUpdateRow supplier={supplier} weddingId={weddingId} onRemove={onRemove} />

          {/* Docs */}
          {supplierDocs.length === 0 ? (
            <div className="flex items-center gap-2 py-2">
              <FileText className="size-4 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No documents linked yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {supplierDocs.map((doc) => {
                const status = deriveDocStatus(doc)
                const expiry = getExpiryWarning(doc.expiry_date)
                const isMissing = status === "missing"
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
                    <div className="flex flex-1 items-center gap-2 min-w-0">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium text-foreground">{doc.name ?? "Untitled"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground capitalize">{doc.kind ?? "document"}</span>
                    <DocStatusBadge status={status} />
                    {doc.expiry_date && (
                      expiry.level ? (
                        <ExpiryChip expiryDate={doc.expiry_date} />
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="size-3" />
                          Expires {formatDate(doc.expiry_date)}
                        </span>
                      )
                    )}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      Updated {formatDate(doc.updated_at)}
                    </span>
                    {isMissing && (
                      <Button
                        variant="default"
                        size="sm"
                        className="ml-auto min-h-[36px]"
                        onClick={() => onChase(doc.id)}
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
// Status update row (inside expanded compliance row)
// ---------------------------------------------------------------------------

function StatusUpdateRow({
  supplier,
  weddingId,
  onRemove,
}: {
  supplier: WeddingSupplierRow
  weddingId: string
  onRemove: (rowId: string) => void
}) {
  const [status, setStatus] = React.useState(supplier.status)
  const [pending, setPending] = React.useState(false)

  async function handleStatusChange(newStatus: string) {
    setStatus(newStatus)
    setPending(true)
    try {
      const result = await updateWeddingSupplier({
        weddingId,
        weddingSupplierRowId: supplier.id,
        status: newStatus as SupplierStatus,
      })
      if (!result.ok) toast.error(result.error)
    } finally {
      setPending(false)
    }
  }

  async function handleRemove() {
    setPending(true)
    try {
      const result = await removeWeddingSupplier({
        weddingId,
        weddingSupplierRowId: supplier.id,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      onRemove(supplier.id)
      toast.success(`${supplier.name} removed from wedding`)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={status} onValueChange={handleStatusChange} disabled={pending}>
        <SelectTrigger className="w-36 h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="enquired">Enquired</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="confirmed">Confirmed</SelectItem>
          <SelectItem value="declined">Declined</SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="sm"
        className="min-h-[36px] text-destructive hover:text-destructive hover:border-destructive/40"
        onClick={handleRemove}
        disabled={pending}
      >
        Remove
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Event-day arrival row
// ---------------------------------------------------------------------------

function ArrivalRow({
  supplier,
  weddingId,
}: {
  supplier: WeddingSupplierRow
  weddingId: string
}) {
  const [checkedIn, setCheckedIn] = React.useState<string | null>(
    supplier.checked_in_at,
  )
  const [pending, setPending] = React.useState(false)

  async function handleCheckIn() {
    setPending(true)
    try {
      const result = await checkInWeddingSupplier({
        weddingId,
        weddingSupplierRowId: supplier.id,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setCheckedIn(new Date().toISOString())
      toast.success(`${supplier.name} checked in`)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 min-h-[56px] border-b border-border last:border-0 transition-colors hover:bg-accent/40 sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-center sm:gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <CategoryIcon category={supplier.category} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{supplier.name}</p>
          <p className="text-xs text-muted-foreground">{supplier.contact_name ?? "—"}</p>
        </div>
      </div>

      <div>
        {supplier.arrival_time ? (
          <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-foreground">
            <Clock className="size-3.5 text-muted-foreground" />
            {supplier.arrival_time.slice(0, 5)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">TBC</span>
        )}
      </div>

      <div>
        <SupplierStatusBadge status={supplier.status as SupplierStatus} />
      </div>

      <div className="hidden sm:block">
        {checkedIn ? (
          <Badge variant="success" className="gap-1">
            <ShieldCheck className="size-3" />
            Checked in
          </Badge>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="min-h-[36px] gap-1"
            onClick={handleCheckIn}
            disabled={pending}
          >
            <ShieldCheck className="size-3.5" />
            Check in
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:justify-end">
        {supplier.phone && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={`tel:${supplier.phone}`}
                  className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Call ${supplier.contact_name ?? supplier.name}`}
                >
                  <Phone className="size-4" />
                </a>
              </TooltipTrigger>
              <TooltipContent><p>Call {supplier.phone}</p></TooltipContent>
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
                  aria-label={`Email ${supplier.contact_name ?? supplier.name}`}
                >
                  <Mail className="size-4" />
                </a>
              </TooltipTrigger>
              <TooltipContent><p>Email {supplier.email}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Directory supplier card
// ---------------------------------------------------------------------------

function DirectoryCard({
  ds,
  alreadyAttached,
  weddingId,
  onAdded,
}: {
  ds: DirectorySupplierRow
  alreadyAttached: boolean
  weddingId: string
  onAdded: (row: WeddingSupplierRow) => void
}) {
  const [pending, setPending] = React.useState(false)
  const [attached, setAttached] = React.useState(alreadyAttached)

  async function handleAdd() {
    setPending(true)
    try {
      const result = await attachSupplierFromDirectory({
        weddingId,
        supplierId: ds.id,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setAttached(true)
      onAdded(result.data)
      toast.success(`${ds.name} added to wedding`, {
        description: `${ds.contact_name ?? ""} · ${ds.category} — you can now log their docs and arrival time.`,
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <CategoryIcon category={ds.category} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{ds.name}</p>
            {ds.venue_approved && (
              <Badge variant="success" className="gap-1 text-[10px]">
                <ShieldCheck className="size-2.5" />
                Approved
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{ds.category}</p>
        </div>
        {ds.avg_rating != null && (
          <span className="flex items-center gap-1 text-xs font-medium tabular-nums text-warning-foreground">
            <Star className="size-3 fill-current" />
            {ds.avg_rating.toFixed(1)}
          </span>
        )}
      </div>

      {ds.notes && (
        <p className="text-xs text-muted-foreground line-clamp-2">{ds.notes}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
        {ds.phone && (
          <a
            href={`tel:${ds.phone}`}
            className="flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Phone className="size-3.5" />
            {ds.phone}
          </a>
        )}
        {ds.email && (
          <a
            href={`mailto:${ds.email}`}
            className="flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Mail className="size-3.5" />
            <span className="truncate max-w-[140px]">{ds.email}</span>
          </a>
        )}
        {ds.website && (
          <a
            href={ds.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Visit ${ds.name} website`}
          >
            <Globe className="size-3.5" />
            <ExternalLink className="size-3" />
          </a>
        )}
        <div className="ml-auto">
          {attached ? (
            <Badge variant="success" className="gap-1">
              <ShieldCheck className="size-3" />
              On this wedding
            </Badge>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="min-h-[36px] gap-1.5"
              onClick={handleAdd}
              disabled={pending}
            >
              <PlusCircle className="size-3.5" />
              {pending ? "Adding…" : "Add to wedding"}
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
  weddingId,
  coupleName,
  suppliers: initialSuppliers,
  documents,
  directorySuppliers,
}: SuppliersClientProps) {
  const [suppliers, setSuppliers] = React.useState(initialSuppliers)
  const [search, setSearch] = React.useState("")
  const [activeStatuses, setActiveStatuses] = React.useState<Set<SupplierStatus>>(new Set())
  const [activeCategories, setActiveCategories] = React.useState<Set<string>>(new Set())
  const [prefSearch, setPrefSearch] = React.useState("")
  const [prefCategory, setPrefCategory] = React.useState<string | null>(null)
  const [addSheetOpen, setAddSheetOpen] = React.useState(false)

  // Track which directory suppliers are already on this wedding
  const attachedSupplierIds = React.useMemo(
    () => new Set(suppliers.map((s) => s.supplier_id).filter(Boolean) as string[]),
    [suppliers],
  )

  // Build map: directory supplier ID → docs
  // wedding_documents.supplier_id is a FK to suppliers (directory), not wedding_suppliers.
  // For ad-hoc wedding suppliers (supplier_id = null), docs remain unlinked.
  const docsByDirectoryId = React.useMemo(() => {
    const map = new Map<string, WeddingDocumentRow[]>()
    for (const doc of documents) {
      if (doc.supplier_id) {
        const existing = map.get(doc.supplier_id) ?? []
        map.set(doc.supplier_id, [...existing, doc])
      }
    }
    return map
  }, [documents])

  const unlinkedDocs = React.useMemo(
    () => documents.filter((d) => !d.supplier_id),
    [documents],
  )

  // Stats
  const confirmedCount = suppliers.filter((s) => s.status === "confirmed").length
  const pendingCount = suppliers.filter(
    (s) => s.status === "pending" || s.status === "enquired",
  ).length

  // Derive doc statuses for warnings
  const allDocStatuses = documents.map((d) => ({
    ...d,
    _status: deriveDocStatus(d),
  }))
  const missingDocs = allDocStatuses.filter((d) => d._status === "missing")
  const expiryWarnings = allDocStatuses.filter(
    (d) => d.kind === "insurance" && getExpiryWarning(d.expiry_date).level !== null,
  )

  const allCategories = React.useMemo(
    () => [...new Set(suppliers.map((s) => s.category))],
    [suppliers],
  )

  const allStatuses: SupplierStatus[] = ["confirmed", "pending", "enquired", "declined"]

  const filteredSuppliers = React.useMemo(() => {
    return suppliers.filter((s) => {
      const q = search.toLowerCase()
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        (s.contact_name ?? "").toLowerCase().includes(q)
      const matchesStatus = activeStatuses.size === 0 || activeStatuses.has(s.status as SupplierStatus)
      const matchesCategory = activeCategories.size === 0 || activeCategories.has(s.category)
      return matchesSearch && matchesStatus && matchesCategory
    })
  }, [suppliers, search, activeStatuses, activeCategories])

  const sortedByArrival = React.useMemo(() => {
    return [...filteredSuppliers].sort((a, b) => {
      if (!a.arrival_time && !b.arrival_time) return 0
      if (!a.arrival_time) return 1
      if (!b.arrival_time) return -1
      return a.arrival_time.localeCompare(b.arrival_time)
    })
  }, [filteredSuppliers])

  // Filter directory
  const prefCategories = React.useMemo(
    () => [...new Set(directorySuppliers.map((p) => p.category))],
    [directorySuppliers],
  )

  const filteredDirectory = React.useMemo(() => {
    return directorySuppliers.filter((p) => {
      const q = prefSearch.toLowerCase()
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
      const matchesCategory = !prefCategory || p.category === prefCategory
      return matchesSearch && matchesCategory
    })
  }, [directorySuppliers, prefSearch, prefCategory])

  // Handlers
  const toggleStatus = (status: SupplierStatus) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status); else next.add(status)
      return next
    })
  }

  const toggleCategory = (cat: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  const handleSupplierAdded = (row: WeddingSupplierRow) => {
    setSuppliers((prev) => [...prev, row])
  }

  const handleSupplierRemoved = (rowId: string) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== rowId))
  }

  async function handleChaseDoc(docId: string) {
    const result = await chaseMissingDoc({ weddingId, documentId: docId })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Chase recorded", {
      description: "Last chased timestamp updated.",
    })
  }

  const hasFilters = activeStatuses.size > 0 || activeCategories.size > 0 || search

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Suppliers"
        subtitle={coupleName}
        actions={
          <Link
            href={`/weddings/${weddingId}`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-xs transition-all hover:border-foreground/30 hover:shadow-sm"
          >
            <ArrowLeft className="size-4 shrink-0 text-muted-foreground" />
            Back to workspace
          </Link>
        }
      />

      {/* Alert banners */}
      <div className="mb-6 space-y-2">
        {missingDocs.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/8 px-4 py-3.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {missingDocs.length === 1 ? "1 document missing" : `${missingDocs.length} documents missing`}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {missingDocs.map((d) => d.name ?? "Untitled").join(", ")} — action required before the wedding.
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
                    const w = getExpiryWarning(d.expiry_date)
                    return w.level === "expired"
                      ? `${d.name ?? "Untitled"} (expired)`
                      : `${d.name ?? "Untitled"} (expires in ${w.daysLeft}d)`
                  })
                  .join(", ")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Stats strip */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Confirmed"
          value={`${confirmedCount} / ${suppliers.length}`}
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

      {/* Main tabs */}
      <Tabs defaultValue="compliance" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="compliance" className="gap-1.5">
              Compliance
              <Badge variant="secondary" className="tabular-nums text-[10px] px-1.5 py-0">
                {suppliers.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="arrivals" className="gap-1.5">
              Event-day arrivals
              <Badge variant="secondary" className="tabular-nums text-[10px] px-1.5 py-0">
                {suppliers.filter((s) => s.arrival_time).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="directory">
              Venue directory
              <Badge variant="secondary" className="tabular-nums text-[10px] px-1.5 ml-1.5 py-0">
                {directorySuppliers.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
          <Button
            variant="default"
            size="sm"
            className="min-h-[44px]"
            onClick={() => setAddSheetOpen(true)}
          >
            <PlusCircle className="size-4" />
            Add supplier
          </Button>
        </div>

        {/* Compliance tab */}
        <TabsContent value="compliance" className="space-y-4">
          <DataToolbar
            search={{
              value: search,
              onChange: setSearch,
              placeholder: "Search suppliers…",
            }}
            resultCount={filteredSuppliers.length}
            totalCount={suppliers.length}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Status:
              </span>
              {allStatuses.map((status) => {
                const count = suppliers.filter((s) => s.status === status).length
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
                  onClick={() => { setSearch(""); setActiveStatuses(new Set()); setActiveCategories(new Set()) }}
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-3" />
                  Clear all
                </button>
              )}
            </div>
          </DataToolbar>

          <Card className="overflow-hidden">
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
                {suppliers.length === 0 ? (
                  <>
                    <p className="text-sm font-semibold text-foreground">No suppliers on this wedding yet</p>
                    <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                      Add a supplier manually or pick from the venue directory.
                    </p>
                    <Button
                      variant="default"
                      size="sm"
                      className="mt-4 min-h-[44px]"
                      onClick={() => setAddSheetOpen(true)}
                    >
                      <PlusCircle className="size-4" />
                      Add supplier
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-foreground">No suppliers match your filters</p>
                    <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                      Try clearing the status or category filters.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 min-h-[44px]"
                      onClick={() => { setSearch(""); setActiveStatuses(new Set()); setActiveCategories(new Set()) }}
                    >
                      Clear filters
                    </Button>
                  </>
                )}
              </div>
            ) : (
              filteredSuppliers.map((supplier) => (
                <SupplierComplianceRow
                  key={supplier.id}
                  supplier={supplier}
                  supplierDocs={
                    supplier.supplier_id
                      ? (docsByDirectoryId.get(supplier.supplier_id) ?? [])
                      : []
                  }
                  weddingId={weddingId}
                  onChase={handleChaseDoc}
                  onRemove={handleSupplierRemoved}
                />
              ))
            )}
          </Card>

          {/* Unlinked wedding-level docs */}
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
                  const status = deriveDocStatus(doc)
                  const isMissing = status === "missing"
                  const expiry = getExpiryWarning(doc.expiry_date)
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
                        <span className="truncate font-medium text-foreground">{doc.name ?? "Untitled"}</span>
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">{doc.kind ?? "document"}</span>
                      <DocStatusBadge status={status} />
                      {doc.expiry_date && expiry.level && <ExpiryChip expiryDate={doc.expiry_date} />}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        Updated {formatDate(doc.updated_at)}
                      </span>
                      {isMissing && (
                        <Button
                          variant="default"
                          size="sm"
                          className="ml-auto min-h-[36px]"
                          onClick={() => handleChaseDoc(doc.id)}
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

        {/* Event-day arrivals tab */}
        <TabsContent value="arrivals" className="space-y-4">
          <DataToolbar
            search={{
              value: search,
              onChange: setSearch,
              placeholder: "Search suppliers…",
            }}
            resultCount={filteredSuppliers.length}
            totalCount={suppliers.length}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Status:
              </span>
              {allStatuses.map((status) => {
                const count = suppliers.filter((s) => s.status === status).length
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
                <ArrivalRow key={supplier.id} supplier={supplier} weddingId={weddingId} />
              ))
            )}
          </Card>

          <p className="text-xs text-muted-foreground">
            Arrival times sorted chronologically. Tap the phone icon for one-tap call on event day.
            Suppliers without a confirmed arrival time appear at the end.
          </p>
        </TabsContent>

        {/* Venue directory tab */}
        <TabsContent value="directory" className="space-y-4">
          <DataToolbar
            search={{
              value: prefSearch,
              onChange: setPrefSearch,
              placeholder: "Search venue directory…",
            }}
            resultCount={filteredDirectory.length}
            totalCount={directorySuppliers.length}
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
                  count={directorySuppliers.filter((p) => p.category === cat).length}
                  onToggle={() => setPrefCategory((prev) => (prev === cat ? null : cat))}
                />
              ))}
            </div>
          </DataToolbar>

          {directorySuppliers.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-border bg-card py-14 text-center shadow-xs">
              <Users className="mb-3 size-10 text-muted-foreground/30" />
              <p className="text-sm font-semibold text-foreground">No preferred suppliers in directory yet</p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Your venue administrator can add suppliers in Settings.
              </p>
            </div>
          ) : filteredDirectory.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-border bg-card py-14 text-center shadow-xs">
              <Users className="mb-3 size-10 text-muted-foreground/30" />
              <p className="text-sm font-semibold text-foreground">No suppliers found</p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Try a different search or category filter.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDirectory.map((ds) => (
                <DirectoryCard
                  key={ds.id}
                  ds={ds}
                  alreadyAttached={attachedSupplierIds.has(ds.id)}
                  weddingId={weddingId}
                  onAdded={handleSupplierAdded}
                />
              ))}
            </div>
          )}

          {directorySuppliers.length > 0 && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {directorySuppliers.filter((p) => p.venue_approved).length} venue-approved
              </span>{" "}
              of {directorySuppliers.length} suppliers in the directory.
            </p>
          )}
        </TabsContent>
      </Tabs>

      {/* Add supplier sheet */}
      <AddSupplierSheet
        weddingId={weddingId}
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
        onAdded={handleSupplierAdded}
      />
    </div>
  )
}
