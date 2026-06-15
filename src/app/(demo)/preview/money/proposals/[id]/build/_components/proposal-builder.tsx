"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
  Send,
  Eye,
  ArrowLeft,
  Search,
  Package,
  UtensilsCrossed,
  Wine,
  Moon,
  Sparkles,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ProposalStatusBadge } from "@/components/status-badges"

import {
  gbp,
  formatLongDate,
  proposalSubtotal,
  applyDiscount,
  depositAmount,
  generateSchedule,
  type ProposalLine,
  type Contact,
} from "@/lib/mock"
import type { Proposal, PriceLibraryItem } from "@/lib/mock"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VenueBilling {
  vatRegistered: boolean
  vatPct: number
  defaultDepositPct: number
  defaultHoldDays: number
  currency: "GBP"
}

export interface ProposalBuilderProps {
  proposal: Proposal
  contact: Contact | undefined
  priceLibrary: PriceLibraryItem[]
  venueBilling: VenueBilling
}

// ---------------------------------------------------------------------------
// Category icon map
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<PriceLibraryItem["category"], React.ElementType> = {
  venue_hire: Package,
  catering: UtensilsCrossed,
  drinks: Wine,
  evening: Moon,
  extras: Sparkles,
}

const CATEGORY_LABELS: Record<PriceLibraryItem["category"], string> = {
  venue_hire: "Venue hire",
  catering: "Catering",
  drinks: "Drinks",
  evening: "Evening",
  extras: "Extras",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function unitLabel(item: PriceLibraryItem): string {
  if (item.unitType === "flat") return "flat"
  if (item.unitType === "per_head") return "per head"
  return "per evening guest"
}

// ---------------------------------------------------------------------------
// QtyStepper
// ---------------------------------------------------------------------------

function QtyStepper({
  value,
  onChange,
  min = 1,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex size-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <ChevronDown className="size-3.5" />
      </button>
      <Input
        type="number"
        value={value}
        min={min}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10)
          if (!isNaN(n) && n >= min) onChange(n)
        }}
        className="h-7 w-16 text-center text-sm tabular-nums px-1"
        aria-label="Quantity"
      />
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(value + 1)}
        className="flex size-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <ChevronUp className="size-3.5" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CommercialSummary
// ---------------------------------------------------------------------------

interface CommercialSummaryProps {
  lines: ProposalLine[]
  discount: Proposal["discount"]
  depositPct: number
  vatPct: number
  vatRegistered: boolean
  guestCount: number | null
  weddingDate: string | null
  onDiscountChange: (d: Proposal["discount"]) => void
  onDepositPctChange: (v: number) => void
}

function CommercialSummary({
  lines,
  discount,
  depositPct,
  vatPct,
  vatRegistered,
  guestCount,
  weddingDate,
  onDiscountChange,
  onDepositPctChange,
}: CommercialSummaryProps) {
  const subtotal = proposalSubtotal(lines)
  const afterDiscount = applyDiscount(subtotal, discount)
  const vatAmount = vatRegistered ? afterDiscount * (vatPct / 100) : 0
  const total = afterDiscount + vatAmount
  const deposit = depositAmount(total, depositPct)

  const schedule = weddingDate
    ? generateSchedule(total, depositPct, weddingDate)
    : null

  // Discount input local state
  const [discountType, setDiscountType] = React.useState<"pct" | "fixed">(
    discount?.type ?? "pct",
  )
  const [discountValue, setDiscountValue] = React.useState(
    discount?.value?.toString() ?? "",
  )

  function applyDiscountInput() {
    const v = parseFloat(discountValue)
    if (!isNaN(v) && v > 0) {
      onDiscountChange({ type: discountType, value: v })
    } else {
      onDiscountChange(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Totals */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Commercial summary
        </p>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums font-medium text-foreground">
              {gbp(subtotal)}
            </span>
          </div>

          {discount && (
            <div className="flex justify-between text-fun-green-strong">
              <span>
                Discount (
                {discount.type === "pct"
                  ? `${discount.value}%`
                  : gbp(discount.value)}
                )
              </span>
              <span className="tabular-nums">
                −{gbp(subtotal - afterDiscount)}
              </span>
            </div>
          )}

          {vatRegistered && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">VAT ({vatPct}%)</span>
              <span className="tabular-nums text-muted-foreground">
                {gbp(vatAmount)}
              </span>
            </div>
          )}

          <Separator />

          <div className="flex justify-between text-base font-bold">
            <span className="text-foreground">Total</span>
            <span className="tabular-nums text-foreground">{gbp(total)}</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Discount control */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Discount
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setDiscountType("pct")}
            className={cn(
              "rounded-md px-2.5 py-1 text-sm font-medium transition-colors border",
              discountType === "pct"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:bg-muted",
            )}
          >
            %
          </button>
          <button
            type="button"
            onClick={() => setDiscountType("fixed")}
            className={cn(
              "rounded-md px-2.5 py-1 text-sm font-medium transition-colors border",
              discountType === "fixed"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:bg-muted",
            )}
          >
            £
          </button>
          <Input
            type="number"
            min={0}
            placeholder={discountType === "pct" ? "e.g. 5" : "e.g. 500"}
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            onBlur={applyDiscountInput}
            onKeyDown={(e) => e.key === "Enter" && applyDiscountInput()}
            className="h-8 flex-1 text-sm"
            aria-label="Discount amount"
          />
          {discount && (
            <button
              type="button"
              aria-label="Remove discount"
              onClick={() => {
                setDiscountValue("")
                onDiscountChange(null)
              }}
              className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <Separator />

      {/* Deposit % */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Deposit
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={10}
            max={100}
            value={depositPct}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              if (!isNaN(v) && v >= 10 && v <= 100) onDepositPctChange(v)
            }}
            className="h-8 w-20 text-sm tabular-nums"
            aria-label="Deposit percentage"
          />
          <span className="text-sm text-muted-foreground">%</span>
          <span className="ml-auto text-sm font-semibold tabular-nums text-foreground">
            {gbp(deposit)}
          </span>
        </div>
      </div>

      {/* Payment schedule preview */}
      {schedule && (
        <>
          <Separator />
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Payment schedule preview
            </p>
            <ol className="space-y-2">
              {schedule.map((m, i) => (
                <li key={i} className="flex items-start justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground leading-snug">
                      {m.label}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatLongDate(m.dueDate)}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums font-semibold text-foreground">
                    {gbp(m.amount)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PriceLibraryPicker (cmdk dialog)
// ---------------------------------------------------------------------------

interface PriceLibraryPickerProps {
  open: boolean
  onClose: () => void
  priceLibrary: PriceLibraryItem[]
  guestCount: number | null
  onAdd: (item: PriceLibraryItem) => void
}

function PriceLibraryPicker({
  open,
  onClose,
  priceLibrary,
  guestCount,
  onAdd,
}: PriceLibraryPickerProps) {
  const categories = Array.from(
    new Set(priceLibrary.map((i) => i.category)),
  ) as PriceLibraryItem["category"][]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 overflow-hidden max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>Add from price library</DialogTitle>
        </DialogHeader>
        <Command className="rounded-xl">
          <CommandInput placeholder="Search price library…" autoFocus />
          <CommandList className="max-h-[420px]">
            <CommandEmpty>No items found.</CommandEmpty>
            {categories.map((cat, ci) => {
              const Icon = CATEGORY_ICONS[cat]
              const items = priceLibrary.filter((i) => i.category === cat)
              return (
                <React.Fragment key={cat}>
                  {ci > 0 && <CommandSeparator />}
                  <CommandGroup heading={CATEGORY_LABELS[cat]}>
                    {items.map((item) => {
                      const defaultQty =
                        item.defaultQtySource === "guest_count"
                          ? (guestCount ?? 1)
                          : item.defaultQtySource === "evening_count"
                            ? Math.round((guestCount ?? 60) * 0.5)
                            : 1
                      return (
                        <CommandItem
                          key={item.id}
                          value={`${item.name} ${item.category}`}
                          onSelect={() => {
                            onAdd(item)
                            onClose()
                          }}
                          className="flex items-start gap-3 py-2.5 cursor-pointer"
                        >
                          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground leading-snug">
                              {item.name}
                            </p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground leading-snug mt-0.5 line-clamp-1">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold tabular-nums text-foreground">
                              {gbp(item.unit)}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {unitLabel(item)}
                            </p>
                          </div>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </React.Fragment>
              )
            })}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// LineItemEditor
// ---------------------------------------------------------------------------

interface LineItemEditorProps {
  lines: ProposalLine[]
  guestCount: number | null
  onLinesChange: (lines: ProposalLine[]) => void
  onOpenLibrary: () => void
}

function LineItemEditor({
  lines,
  guestCount,
  onLinesChange,
  onOpenLibrary,
}: LineItemEditorProps) {
  // Group lines by category.
  const packages = lines.filter((l) => l.category !== "addon")
  const addons = lines.filter((l) => l.category === "addon")

  function updateLine(id: string, patch: Partial<ProposalLine>) {
    onLinesChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  function removeLine(id: string) {
    onLinesChange(lines.filter((l) => l.id !== id))
  }

  function toggleGuestTie(line: ProposalLine) {
    const tying = !line.qtyTiedToGuests
    updateLine(line.id, {
      qtyTiedToGuests: tying,
      qty: tying && guestCount ? guestCount : line.qty,
    })
  }

  function renderLines(group: ProposalLine[], label: string) {
    if (group.length === 0) return null
    return (
      <div className="mb-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <div className="space-y-1">
          {group.map((line) => {
            const lineAmt = line.qty * line.unit
            return (
              <div
                key={line.id}
                className="group/row flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 hover:border-border/80 hover:bg-accent/30 transition-colors"
              >
                {/* Label */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground leading-snug truncate">
                    {line.label}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {gbp(line.unit)}{" "}
                    {line.unitType ? `/ ${line.unitType.replace(/_/g, " ")}` : ""}
                  </p>
                </div>

                {/* Per-head toggle */}
                <button
                  type="button"
                  title={
                    line.qtyTiedToGuests
                      ? "Tied to guest count — click to untie"
                      : "Tie qty to guest count"
                  }
                  onClick={() => toggleGuestTie(line)}
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors",
                    line.qtyTiedToGuests
                      ? "border-primary/50 bg-fun-blue text-fun-blue-strong"
                      : "border-border bg-card text-muted-foreground hover:bg-muted",
                  )}
                  aria-label={
                    line.qtyTiedToGuests ? "Tied to guest count" : "Tie to guest count"
                  }
                  aria-pressed={line.qtyTiedToGuests}
                >
                  <Users className="size-3.5" />
                </button>

                {/* Qty stepper */}
                <QtyStepper
                  value={line.qty}
                  onChange={(v) => updateLine(line.id, { qty: v })}
                />

                {/* Line total */}
                <span className="w-24 min-w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                  {gbp(lineAmt)}
                </span>

                {/* Remove */}
                <button
                  type="button"
                  aria-label={`Remove ${line.label}`}
                  onClick={() => removeLine(line.id)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover/row:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      {lines.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <Package className="size-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">No line items yet</p>
          <p className="text-xs text-muted-foreground">
            Add from the price library or enter a custom item.
          </p>
          <Button variant="outline" size="sm" onClick={onOpenLibrary}>
            <Plus className="size-3.5" />
            Add from price library
          </Button>
        </div>
      ) : (
        <>
          {renderLines(packages, "Package")}
          {renderLines(addons, "Add-ons")}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProposalBuilder (main)
// ---------------------------------------------------------------------------

export function ProposalBuilder({
  proposal: initialProposal,
  contact,
  priceLibrary,
  venueBilling,
}: ProposalBuilderProps) {
  // Local mutable state — optimistic UI over the static mock.
  const [lines, setLines] = React.useState<ProposalLine[]>(initialProposal.lines)
  const [discount, setDiscount] = React.useState<Proposal["discount"]>(
    initialProposal.discount,
  )
  const [depositPct, setDepositPct] = React.useState(initialProposal.depositPct)
  const [status, setStatus] = React.useState<Proposal["status"]>(
    initialProposal.status,
  )
  const [pickerOpen, setPickerOpen] = React.useState(false)

  const guestCount = contact?.guestCount ?? null
  const weddingDate = contact?.weddingDate ?? null

  // Keyboard shortcut: ⌘K / Ctrl+K opens library picker.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setPickerOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function addFromLibrary(item: PriceLibraryItem) {
    const defaultQty =
      item.defaultQtySource === "guest_count"
        ? (guestCount ?? 1)
        : item.defaultQtySource === "evening_count"
          ? Math.round((guestCount ?? 60) * 0.5)
          : 1

    const newLine: ProposalLine = {
      id: `prl_new_${Date.now()}`,
      label: item.name,
      qty: defaultQty,
      unit: item.unit,
      category: "addon",
      libraryItemId: item.id,
      unitType: item.unitType,
      qtyTiedToGuests: item.defaultQtySource === "guest_count",
    }
    setLines((prev) => [...prev, newLine])
    toast.success(`Added: ${item.name}`)
  }

  function handleSend() {
    setStatus("sent")
    toast.success("Proposal sent to couple", {
      description: contact
        ? `${contact.coupleName} will receive a link via ${contact.lastChannel}.`
        : "The couple will receive a link.",
    })
  }

  function handlePreview() {
    toast("Opening preview", {
      description: "Couple-facing preview — branded with your venue identity.",
    })
  }

  const subtotal = proposalSubtotal(lines)
  const afterDiscount = applyDiscount(subtotal, discount)
  const vatAmount = venueBilling.vatRegistered
    ? afterDiscount * (venueBilling.vatPct / 100)
    : 0
  const total = afterDiscount + vatAmount

  return (
    <>
      {/* ── Top bar ── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/preview/money">
              <ArrowLeft className="size-3.5" />
              Back
            </Link>
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {contact?.coupleName ?? "Draft proposal"}
            </span>
            <ProposalStatusBadge status={status} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {gbp(total)}
          </span>
          <Button variant="outline" size="sm" onClick={handlePreview}>
            <Eye className="size-3.5" />
            Preview
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={lines.length === 0 || status === "accepted"}
          >
            <Send className="size-3.5" />
            Send
          </Button>
        </div>
      </div>

      {/* ── Three-pane workspace ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        {/* LEFT — Line-item editor */}
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm font-semibold text-foreground">
                Line items
                {guestCount && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    · {guestCount} guests
                  </span>
                )}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
              >
                <Plus className="size-3.5" />
                Add item
                <kbd className="ml-1.5 hidden sm:inline-flex h-4 items-center gap-0.5 rounded border border-border bg-muted px-1 text-[10px] font-medium text-muted-foreground">
                  <span>⌘</span>K
                </kbd>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <LineItemEditor
              lines={lines}
              guestCount={guestCount}
              onLinesChange={setLines}
              onOpenLibrary={() => setPickerOpen(true)}
            />

            {/* Subtotal footer */}
            {lines.length > 0 && (
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <span className="text-sm text-muted-foreground">
                  {lines.length} item{lines.length !== 1 ? "s" : ""}
                </span>
                <span className="text-sm font-bold tabular-nums text-foreground">
                  Subtotal: {gbp(subtotal)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT — Commercial summary rail */}
        <Card className="lg:self-start">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-sm font-semibold text-foreground">
              Commercial summary
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <CommercialSummary
              lines={lines}
              discount={discount}
              depositPct={depositPct}
              vatPct={venueBilling.vatPct}
              vatRegistered={venueBilling.vatRegistered}
              guestCount={guestCount}
              weddingDate={weddingDate}
              onDiscountChange={setDiscount}
              onDepositPctChange={setDepositPct}
            />
          </CardContent>
        </Card>
      </div>

      {/* Price library picker */}
      <PriceLibraryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        priceLibrary={priceLibrary}
        guestCount={guestCount}
        onAdd={addFromLibrary}
      />
    </>
  )
}
