"use client"

import * as React from "react"
import {
  Plus,
  Pencil,
  MoreHorizontal,
  Package as PackageIcon,
  Check,
  ChevronRight,
  ChevronDown,
  CreditCard,
  Utensils,
} from "lucide-react"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { DataToolbar } from "@/components/data-toolbar"
import { EntitySheet } from "@/components/entity-sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type {
  Package as VFPackage,
  PackageLine,
  MenuLibraryItem,
} from "@/lib/mock"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gbp(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}

function unitLabel(unitType: PackageLine["unitType"]): string {
  if (unitType === "per_head") return "/ head"
  if (unitType === "per_evening") return "/ evening"
  return "flat"
}

// Season → pastel chip classes
const SEASON_CLASSES: Record<string, string> = {
  Summer: "bg-fun-pink text-fun-pink-foreground",
  Autumn: "bg-warning text-warning-foreground",
  Winter: "bg-fun-blue text-foreground",
  Spring: "bg-fun-green text-foreground",
  "All year": "bg-muted text-muted-foreground",
}
function seasonClass(season: string) {
  return SEASON_CLASSES[season] ?? "bg-accent text-accent-foreground"
}

// Add-ons / drinks: menu library courses to surface in the price list
const ADDON_COURSES = ["Evening", "Drinks"]

// ---------------------------------------------------------------------------
// Form value shapes
// ---------------------------------------------------------------------------

interface PackageFormValues {
  name: string
  season: string
  description: string
  fromPrice: string
}

interface LineFormValues {
  label: string
  unit: string
  unitType: PackageLine["unitType"]
  qtyTiedToGuests: boolean
}

// ---------------------------------------------------------------------------
// PackageLine form
// ---------------------------------------------------------------------------

function PackageLineForm({
  value,
  onChange,
}: {
  value: LineFormValues
  onChange: (v: LineFormValues) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="line-label" className="text-sm font-medium">
          Line item label
        </Label>
        <Input
          id="line-label"
          value={value.label}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
          placeholder="e.g. Drinks package — Classic"
          className="h-9 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="line-price" className="text-sm font-medium">
            Price (£)
          </Label>
          <Input
            id="line-price"
            type="number"
            min={0}
            step={0.01}
            value={value.unit}
            onChange={(e) => onChange({ ...value, unit: e.target.value })}
            placeholder="0"
            className="h-9 text-sm tabular-nums"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="line-unit-type" className="text-sm font-medium">
            Unit type
          </Label>
          <Select
            value={value.unitType}
            onValueChange={(v) =>
              onChange({ ...value, unitType: v as PackageLine["unitType"] })
            }
          >
            <SelectTrigger id="line-unit-type" className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flat">Flat fee</SelectItem>
              <SelectItem value="per_head">Per head</SelectItem>
              <SelectItem value="per_evening">Per evening</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="line-tied"
          checked={value.qtyTiedToGuests}
          onChange={(e) =>
            onChange({ ...value, qtyTiedToGuests: e.target.checked })
          }
          className="size-4 rounded border-border accent-primary cursor-pointer"
        />
        <Label htmlFor="line-tied" className="text-sm font-medium cursor-pointer">
          Quantity tied to guest count
        </Label>
      </div>

      <p className="text-[11px] text-muted-foreground">
        When checked, the proposal builder multiplies this price by the
        couple&apos;s guest count automatically.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Package form
// ---------------------------------------------------------------------------

const SEASONS = ["Summer", "Autumn", "Winter", "Spring", "All year"]

function PackageForm({
  value,
  onChange,
}: {
  value: PackageFormValues
  onChange: (v: PackageFormValues) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pkg-name" className="text-sm font-medium">
          Package name
        </Label>
        <Input
          id="pkg-name"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="e.g. The Full Day — Summer"
          className="h-9 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pkg-season" className="text-sm font-medium">
          Season
        </Label>
        <Select
          value={value.season}
          onValueChange={(v) => onChange({ ...value, season: v })}
        >
          <SelectTrigger id="pkg-season" className="h-9 text-sm">
            <SelectValue placeholder="Select season" />
          </SelectTrigger>
          <SelectContent>
            {SEASONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pkg-desc" className="text-sm font-medium">
          Description
        </Label>
        <Textarea
          id="pkg-desc"
          value={value.description}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          placeholder="Brief summary shown to couples in proposals…"
          className="min-h-[80px] text-sm resize-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pkg-price" className="text-sm font-medium">
          From price (£)
        </Label>
        <Input
          id="pkg-price"
          type="number"
          min={0}
          step={100}
          value={value.fromPrice}
          onChange={(e) => onChange({ ...value, fromPrice: e.target.value })}
          placeholder="0"
          className="h-9 text-sm tabular-nums"
        />
        <p className="text-[11px] text-muted-foreground">
          Shown on the enquiry brochure as the headline starting price.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Package card — collapsible, shows all line items when expanded
// ---------------------------------------------------------------------------

interface PackageCardProps {
  pkg: VFPackage
  isExpanded: boolean
  onToggle: () => void
  onEdit: () => void
  onArchive: () => void
  onAddLine: () => void
  onEditLine: (lineId: string) => void
}

function PackageCard({
  pkg,
  isExpanded,
  onToggle,
  onEdit,
  onArchive,
  onAddLine,
  onEditLine,
}: PackageCardProps) {
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm",
        "transition-shadow hover:shadow-md",
        !pkg.isActive && "opacity-60",
      )}
    >
      {/* Card header row */}
      <div className="flex min-h-[56px] items-center gap-3 px-4 py-3">
        {/* Expand toggle */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Collapse package" : "Expand package"}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md",
            "text-muted-foreground transition-colors",
            "hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <ChevronIcon className="size-4" aria-hidden />
        </button>

        {/* Icon */}
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent">
          <PackageIcon className="size-4 text-accent-foreground" aria-hidden />
        </div>

        {/* Name + meta */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">
              {pkg.name}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5",
                "text-[11px] font-medium",
                seasonClass(pkg.season),
              )}
            >
              {pkg.season}
            </span>
            {!pkg.isActive && (
              <Badge variant="secondary" className="text-[11px]">
                Archived
              </Badge>
            )}
          </div>
          <p className="text-[12px] text-muted-foreground truncate">
            {pkg.description}
          </p>
        </div>

        {/* From price */}
        <div className="flex flex-col items-end shrink-0 mr-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            from
          </span>
          <span className="text-base font-semibold tabular-nums text-foreground">
            {gbp(pkg.fromPrice)}
          </span>
        </div>

        {/* Actions menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${pkg.name}`}
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-3.5" aria-hidden />
              Edit package
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAddLine}>
              <Plus className="size-3.5" aria-hidden />
              Add line item
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onArchive}
              className="text-muted-foreground"
            >
              {pkg.isActive ? "Archive" : "Restore"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Expanded: line items */}
      {isExpanded && (
        <div className="border-t border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Line item
                  </th>
                  <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">
                    Price
                  </th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">
                    Unit
                  </th>
                  <th className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">
                    × guests
                  </th>
                  <th className="w-10 px-2" aria-label="Edit" />
                </tr>
              </thead>
              <tbody>
                {pkg.lines.map((line) => (
                  <tr
                    key={line.id}
                    className="group border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-foreground">
                      {line.label}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-foreground">
                      {gbp(line.unit)}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {unitLabel(line.unitType)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {line.qtyTiedToGuests ? (
                        <Check
                          className="inline size-4 text-fun-green-strong"
                          aria-label="Yes"
                        />
                      ) : (
                        <span
                          className="text-muted-foreground/40 text-xs"
                          aria-label="No"
                        >
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <button
                        type="button"
                        onClick={() => onEditLine(line.id)}
                        aria-label={`Edit ${line.label}`}
                        className={cn(
                          "flex size-7 items-center justify-center rounded",
                          "text-muted-foreground opacity-0 group-hover:opacity-100",
                          "hover:bg-muted hover:text-foreground",
                          "transition-all focus-visible:opacity-100",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        )}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add line CTA */}
          <div className="px-4 py-3">
            <button
              type="button"
              onClick={onAddLine}
              className={cn(
                "flex min-h-[36px] w-full items-center gap-2 rounded-lg",
                "border border-dashed border-border px-3 py-2",
                "text-sm text-muted-foreground",
                "hover:border-primary/40 hover:bg-muted/60 hover:text-foreground",
                "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <Plus className="size-4 shrink-0" aria-hidden />
              Add line item
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add-on / drinks price list row
// ---------------------------------------------------------------------------

function AddOnRow({
  item,
  onEdit,
}: {
  item: MenuLibraryItem
  onEdit: () => void
}) {
  return (
    <tr className="group border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{item.name}</span>
          <span className="text-[12px] text-muted-foreground line-clamp-1">
            {item.description}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-accent text-accent-foreground">
          {item.course}
        </span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground whitespace-nowrap">
        {item.pricePerHead > 0 ? (
          <>
            {gbp(item.pricePerHead)}{" "}
            <span className="text-muted-foreground font-normal">/ head</span>
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {item.dietary.map((d) => (
            <span
              key={d}
              className="inline-flex items-center rounded-full bg-fun-green px-2 py-0.5 text-[11px] font-medium text-foreground"
            >
              {d}
            </span>
          ))}
          {item.dietary.length === 0 && (
            <span className="text-[11px] text-muted-foreground/60">—</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {item.isActive ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="secondary">Inactive</Badge>
        )}
      </td>
      <td className="px-2 py-3">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${item.name}`}
          className={cn(
            "flex size-7 items-center justify-center rounded",
            "text-muted-foreground opacity-0 group-hover:opacity-100",
            "hover:bg-muted hover:text-foreground",
            "transition-all focus-visible:opacity-100",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <Pencil className="size-3.5" aria-hidden />
        </button>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// ControlledSheet — Sheet with externally managed open state, no trigger
// ---------------------------------------------------------------------------

interface ControlledSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  onSave?: () => void
  saveLabel?: string
}

function ControlledSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSave,
  saveLabel = "Save",
}: ControlledSheetProps) {
  function handleSave() {
    onSave?.()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="text-base font-semibold text-foreground">
            {title}
          </SheetTitle>
          {description && (
            <SheetDescription className="text-sm text-muted-foreground">
              {description}
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        <SheetFooter className="border-t border-border px-6 py-4 flex-row items-center justify-end gap-2">
          <SheetClose asChild>
            <Button variant="ghost" size="default">
              Cancel
            </Button>
          </SheetClose>
          <Button variant="default" size="default" onClick={handleSave}>
            {saveLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Main exported client component
// ---------------------------------------------------------------------------

interface PackagesClientProps {
  initialPackages: VFPackage[]
  menuLibrary: MenuLibraryItem[]
}

export function PackagesClient({
  initialPackages,
  menuLibrary,
}: PackagesClientProps) {
  // ── State ─────────────────────────────────────────────────────────────────

  const [packages, setPackages] = React.useState<VFPackage[]>(initialPackages)
  const [search, setSearch] = React.useState("")

  // Default: first package expanded
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(
    () => new Set(initialPackages.slice(0, 1).map((p) => p.id)),
  )

  // New/edit package sheet
  const [pkgSheetMode, setPkgSheetMode] = React.useState<
    "closed" | "new" | "edit"
  >("closed")
  const [editingPkg, setEditingPkg] = React.useState<VFPackage | null>(null)
  const [pkgForm, setPkgForm] = React.useState<PackageFormValues>({
    name: "",
    season: "Summer",
    description: "",
    fromPrice: "",
  })

  // New/edit line item sheet
  const [lineSheetMode, setLineSheetMode] = React.useState<
    "closed" | "add" | "edit"
  >("closed")
  const [lineTargetPkgId, setLineTargetPkgId] = React.useState<string | null>(
    null,
  )
  const [lineTargetLineId, setLineTargetLineId] = React.useState<string | null>(
    null,
  )
  const [lineForm, setLineForm] = React.useState<LineFormValues>({
    label: "",
    unit: "",
    unitType: "flat",
    qtyTiedToGuests: false,
  })

  // Edit add-on sheet
  const [addOnSheetItem, setAddOnSheetItem] =
    React.useState<MenuLibraryItem | null>(null)
  const [addOnForm, setAddOnForm] = React.useState({
    name: "",
    description: "",
    pricePerHead: "",
  })

  // ── Derived ───────────────────────────────────────────────────────────────

  const filteredPackages = React.useMemo(() => {
    if (!search.trim()) return packages
    const q = search.toLowerCase()
    return packages.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.season.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.lines.some((l: PackageLine) => l.label.toLowerCase().includes(q)),
    )
  }, [packages, search])

  const addOnItems = React.useMemo(
    () =>
      menuLibrary.filter(
        (item) =>
          ADDON_COURSES.includes(item.course) ||
          item.course.toLowerCase().includes("drink"),
      ),
    [menuLibrary],
  )

  const filteredAddOns = React.useMemo(() => {
    if (!search.trim()) return addOnItems
    const q = search.toLowerCase()
    return addOnItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.course.toLowerCase().includes(q),
    )
  }, [addOnItems, search])

  // ── Handlers: packages ────────────────────────────────────────────────────

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function openNewPackage() {
    setEditingPkg(null)
    setPkgForm({ name: "", season: "Summer", description: "", fromPrice: "" })
    setPkgSheetMode("new")
  }

  function openEditPackage(pkg: VFPackage) {
    setEditingPkg(pkg)
    setPkgForm({
      name: pkg.name,
      season: pkg.season,
      description: pkg.description,
      fromPrice: String(pkg.fromPrice),
    })
    setPkgSheetMode("edit")
  }

  function savePackage() {
    const fromPrice = Number(pkgForm.fromPrice) || 0
    if (pkgSheetMode === "edit" && editingPkg) {
      setPackages((prev) =>
        prev.map((p) =>
          p.id === editingPkg.id
            ? {
                ...p,
                name: pkgForm.name,
                season: pkgForm.season,
                description: pkgForm.description,
                fromPrice,
              }
            : p,
        ),
      )
      toast("Package updated")
    } else {
      const newPkg: VFPackage = {
        id: `pkg${Date.now()}`,
        name: pkgForm.name,
        season: pkgForm.season,
        description: pkgForm.description,
        fromPrice,
        isActive: true,
        lines: [],
      }
      setPackages((prev) => [...prev, newPkg])
      setExpandedIds((prev) => new Set([...prev, newPkg.id]))
      toast("Package added — add line items to build it out")
    }
  }

  function archivePackage(pkgId: string) {
    const pkg = packages.find((p) => p.id === pkgId)
    setPackages((prev) =>
      prev.map((p) =>
        p.id === pkgId ? { ...p, isActive: !p.isActive } : p,
      ),
    )
    toast(pkg?.isActive ? "Package archived" : "Package restored")
  }

  // ── Handlers: line items ──────────────────────────────────────────────────

  function openAddLine(pkgId: string) {
    setLineTargetPkgId(pkgId)
    setLineTargetLineId(null)
    setLineForm({
      label: "",
      unit: "",
      unitType: "flat",
      qtyTiedToGuests: false,
    })
    setLineSheetMode("add")
  }

  function openEditLine(pkgId: string, lineId: string) {
    const pkg = packages.find((p) => p.id === pkgId)
    const line = pkg?.lines.find((l: PackageLine) => l.id === lineId)
    if (!line) return
    setLineTargetPkgId(pkgId)
    setLineTargetLineId(lineId)
    setLineForm({
      label: line.label,
      unit: String(line.unit),
      unitType: line.unitType,
      qtyTiedToGuests: line.qtyTiedToGuests,
    })
    setLineSheetMode("edit")
  }

  function saveLine() {
    const unit = Number(lineForm.unit) || 0
    if (lineSheetMode === "edit" && lineTargetPkgId && lineTargetLineId) {
      setPackages((prev) =>
        prev.map((p) =>
          p.id === lineTargetPkgId
            ? {
                ...p,
                lines: p.lines.map((l: PackageLine) =>
                  l.id === lineTargetLineId
                    ? {
                        ...l,
                        label: lineForm.label,
                        unit,
                        unitType: lineForm.unitType,
                        qtyTiedToGuests: lineForm.qtyTiedToGuests,
                      }
                    : l,
                ),
              }
            : p,
        ),
      )
      toast("Line item updated")
    } else if (lineSheetMode === "add" && lineTargetPkgId) {
      setPackages((prev) =>
        prev.map((p) =>
          p.id === lineTargetPkgId
            ? {
                ...p,
                lines: [
                  ...p.lines,
                  {
                    id: `pkl${Date.now()}`,
                    label: lineForm.label,
                    unit,
                    unitType: lineForm.unitType,
                    qtyTiedToGuests: lineForm.qtyTiedToGuests,
                  },
                ],
              }
            : p,
        ),
      )
      toast("Line item added")
    }
  }

  // ── Handlers: add-ons ─────────────────────────────────────────────────────

  function openEditAddOn(item: MenuLibraryItem) {
    setAddOnSheetItem(item)
    setAddOnForm({
      name: item.name,
      description: item.description,
      pricePerHead: String(item.pricePerHead),
    })
  }

  // ── Derived counts ────────────────────────────────────────────────────────

  const totalCount = packages.length + addOnItems.length
  const resultCount = filteredPackages.length + filteredAddOns.length

  const lineSheetPkgName =
    packages.find((p) => p.id === lineTargetPkgId)?.name

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* ── Toolbar ── */}
        <DataToolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search packages & add-ons…",
          }}
          resultCount={search ? resultCount : undefined}
          totalCount={search ? totalCount : undefined}
          actions={
            <Button
              variant="default"
              size="sm"
              className="gap-1.5"
              onClick={openNewPackage}
            >
              <Plus className="size-4" aria-hidden />
              Add package
            </Button>
          }
        />

        {/* ── Packages section ── */}
        <section aria-labelledby="packages-heading">
          <div className="mb-3 flex items-center gap-2">
            <CreditCard className="size-4 text-muted-foreground" aria-hidden />
            <h2
              id="packages-heading"
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            >
              Packages ({filteredPackages.length})
            </h2>
          </div>

          {filteredPackages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <PackageIcon
                  className="size-5 text-muted-foreground"
                  aria-hidden
                />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-foreground">
                  {search
                    ? "No packages match your search"
                    : "No packages yet"}
                </p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  {search
                    ? "Try a different search term."
                    : "Add your first package to start pricing proposals for couples."}
                </p>
              </div>
              {!search && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openNewPackage}
                >
                  <Plus className="size-4 mr-1" aria-hidden />
                  Add package
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredPackages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  isExpanded={expandedIds.has(pkg.id)}
                  onToggle={() => toggleExpand(pkg.id)}
                  onEdit={() => openEditPackage(pkg)}
                  onArchive={() => archivePackage(pkg.id)}
                  onAddLine={() => openAddLine(pkg.id)}
                  onEditLine={(lineId) => openEditLine(pkg.id, lineId)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Add-ons / drinks price list section ── */}
        <section aria-labelledby="addons-heading">
          <div className="mb-3 flex items-center gap-2">
            <Utensils className="size-4 text-muted-foreground" aria-hidden />
            <h2
              id="addons-heading"
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            >
              Add-ons &amp; drinks ({filteredAddOns.length})
            </h2>
          </div>

          {filteredAddOns.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {search
                  ? "No add-ons match your search."
                  : "No evening or drinks items in the menu library yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Item
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Course
                      </th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">
                        Price
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Dietary
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Status
                      </th>
                      <th className="w-10 px-2" aria-label="Edit" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAddOns.map((item) => (
                      <AddOnRow
                        key={item.id}
                        item={item}
                        onEdit={() => openEditAddOn(item)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ── Sheets (controlled, no trigger needed) ── */}

      {/* New / Edit Package */}
      <ControlledSheet
        open={pkgSheetMode !== "closed"}
        onOpenChange={(o) => { if (!o) setPkgSheetMode("closed") }}
        title={pkgSheetMode === "edit" ? "Edit package" : "New package"}
        description={
          pkgSheetMode === "edit"
            ? "Update this package's name, season and base price."
            : "Name, season and base price shown to couples on enquiry."
        }
        onSave={savePackage}
        saveLabel={pkgSheetMode === "edit" ? "Save changes" : "Add package"}
      >
        <PackageForm value={pkgForm} onChange={setPkgForm} />
      </ControlledSheet>

      {/* Add / Edit Line item */}
      <ControlledSheet
        open={lineSheetMode !== "closed"}
        onOpenChange={(o) => { if (!o) setLineSheetMode("closed") }}
        title={lineSheetMode === "edit" ? "Edit line item" : "Add line item"}
        description={
          lineSheetPkgName ? `For "${lineSheetPkgName}"` : undefined
        }
        onSave={saveLine}
        saveLabel={lineSheetMode === "edit" ? "Save changes" : "Add line item"}
      >
        <PackageLineForm value={lineForm} onChange={setLineForm} />
      </ControlledSheet>

      {/* Edit Add-on */}
      <ControlledSheet
        open={addOnSheetItem !== null}
        onOpenChange={(o) => { if (!o) setAddOnSheetItem(null) }}
        title="Edit add-on price"
        description="Update the price and details for this add-on item."
        onSave={() => toast("Add-on updated (prototype)")}
        saveLabel="Save changes"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="addon-name" className="text-sm font-medium">
              Name
            </Label>
            <Input
              id="addon-name"
              value={addOnForm.name}
              onChange={(e) =>
                setAddOnForm((f) => ({ ...f, name: e.target.value }))
              }
              className="h-9 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="addon-desc" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="addon-desc"
              value={addOnForm.description}
              onChange={(e) =>
                setAddOnForm((f) => ({ ...f, description: e.target.value }))
              }
              className="min-h-[70px] text-sm resize-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="addon-price" className="text-sm font-medium">
              Price per head (£)
            </Label>
            <Input
              id="addon-price"
              type="number"
              min={0}
              step={0.5}
              value={addOnForm.pricePerHead}
              onChange={(e) =>
                setAddOnForm((f) => ({ ...f, pricePerHead: e.target.value }))
              }
              className="h-9 text-sm tabular-nums"
            />
          </div>
        </div>
      </ControlledSheet>
    </>
  )
}
