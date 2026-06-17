"use client";

import * as React from "react";
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
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { DataToolbar } from "@/components/data-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createPackage,
  updatePackage,
  togglePackageActive,
  createPackageLine,
  updatePackageLine,
  type PackageWithLines,
  type PackageLineRow,
  type MenuItemRow,
} from "./actions";
import { minorToMajor } from "./money";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gbp(minor: number | null): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(minorToMajor(minor));
}

function unitLabel(unitType: string): string {
  if (unitType === "per_head") return "/ head";
  if (unitType === "per_evening") return "/ evening";
  return "flat";
}

const SEASON_CLASSES: Record<string, string> = {
  Summer: "bg-fun-pink text-fun-pink-foreground",
  Autumn: "bg-warning text-warning-foreground",
  Winter: "bg-fun-blue text-foreground",
  Spring: "bg-fun-green text-foreground",
  "All year": "bg-muted text-muted-foreground",
};
function seasonClass(season: string | null): string {
  return SEASON_CLASSES[season ?? ""] ?? "bg-accent text-accent-foreground";
}

const SEASONS = ["Summer", "Autumn", "Winter", "Spring", "All year"] as const;
type Season = (typeof SEASONS)[number];

// ---------------------------------------------------------------------------
// Form value shapes
// ---------------------------------------------------------------------------

interface PackageFormValues {
  name: string;
  season: Season;
  description: string;
  fromPrice: string;
}

interface LineFormValues {
  label: string;
  unit: string;
  unitType: "flat" | "per_head" | "per_evening";
  qtyTiedToGuests: boolean;
}

// ---------------------------------------------------------------------------
// ControlledSheet
// ---------------------------------------------------------------------------

interface ControlledSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  onSave?: () => Promise<void> | void;
  saveLabel?: string;
  saving?: boolean;
}

function ControlledSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSave,
  saveLabel = "Save",
  saving = false,
}: ControlledSheetProps) {
  async function handleSave() {
    await onSave?.();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-md">
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
            <Button variant="ghost" size="default" disabled={saving}>
              Cancel
            </Button>
          </SheetClose>
          <Button
            variant="default"
            size="default"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : saveLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// PackageLineForm
// ---------------------------------------------------------------------------

function PackageLineForm({
  value,
  onChange,
}: {
  value: LineFormValues;
  onChange: (v: LineFormValues) => void;
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
              onChange({ ...value, unitType: v as LineFormValues["unitType"] })
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
  );
}

// ---------------------------------------------------------------------------
// PackageForm
// ---------------------------------------------------------------------------

function PackageForm({
  value,
  onChange,
}: {
  value: PackageFormValues;
  onChange: (v: PackageFormValues) => void;
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
          onValueChange={(v) => onChange({ ...value, season: v as Season })}
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
  );
}

// ---------------------------------------------------------------------------
// PackageCard
// ---------------------------------------------------------------------------

interface PackageCardProps {
  pkg: PackageWithLines;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onAddLine: () => void;
  onEditLine: (lineId: string) => void;
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
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm",
        "transition-shadow hover:shadow-md",
        !pkg.is_active && "opacity-60",
      )}
    >
      {/* Card header row */}
      <div className="flex min-h-[56px] items-center gap-3 px-4 py-3">
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

        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent">
          <PackageIcon className="size-4 text-accent-foreground" aria-hidden />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">
              {pkg.name}
            </span>
            {pkg.season && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5",
                  "text-[11px] font-medium",
                  seasonClass(pkg.season),
                )}
              >
                {pkg.season}
              </span>
            )}
            {!pkg.is_active && (
              <Badge variant="secondary" className="text-[11px]">
                Archived
              </Badge>
            )}
          </div>
          {pkg.description && (
            <p className="text-[12px] text-muted-foreground truncate">
              {pkg.description}
            </p>
          )}
        </div>

        <div className="hidden sm:flex flex-col items-end shrink-0 mr-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            from
          </span>
          <span className="text-base font-semibold tabular-nums text-foreground">
            {gbp(pkg.from_price_minor)}
          </span>
        </div>

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
              {pkg.is_active ? "Archive" : "Restore"}
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
                    <td className="px-4 py-2.5 text-foreground">{line.label}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-foreground">
                      {gbp(line.unit_minor)}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {unitLabel(line.unit_type)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {line.qty_tied_to_guests ? (
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
  );
}

// ---------------------------------------------------------------------------
// AddOnRow — evening/drinks items from menu library
// ---------------------------------------------------------------------------

function AddOnRow({ item }: { item: MenuItemRow }) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{item.name}</span>
          {item.description && (
            <span className="text-[12px] text-muted-foreground line-clamp-1">
              {item.description}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-accent text-accent-foreground capitalize">
          {item.course}
        </span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground whitespace-nowrap">
        {item.price_per_head_minor != null && item.price_per_head_minor > 0 ? (
          <>
            {gbp(item.price_per_head_minor)}{" "}
            <span className="text-muted-foreground font-normal">/ head</span>
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {item.dietary_tags.map((d) => (
            <span
              key={d}
              className="inline-flex items-center rounded-full bg-fun-green px-2 py-0.5 text-[11px] font-medium text-foreground"
            >
              {d}
            </span>
          ))}
          {item.dietary_tags.length === 0 && (
            <span className="text-[11px] text-muted-foreground/60">—</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {item.is_active ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="secondary">Inactive</Badge>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

interface PackagesManagerProps {
  initialPackages: PackageWithLines[];
  initialAddOns: MenuItemRow[];
  canManage: boolean;
}

export function PackagesManager({
  initialPackages,
  initialAddOns,
  canManage,
}: PackagesManagerProps) {
  const router = useRouter();

  // ── State ─────────────────────────────────────────────────────────────────

  const [search, setSearch] = React.useState("");

  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(
    () => new Set(initialPackages.slice(0, 1).map((p) => p.id)),
  );

  // Package sheet
  const [pkgSheetMode, setPkgSheetMode] = React.useState<
    "closed" | "new" | "edit"
  >("closed");
  const [editingPkgId, setEditingPkgId] = React.useState<string | null>(null);
  const [pkgForm, setPkgForm] = React.useState<PackageFormValues>({
    name: "",
    season: "Summer",
    description: "",
    fromPrice: "",
  });
  const [pkgSaving, setPkgSaving] = React.useState(false);

  // Line sheet
  const [lineSheetMode, setLineSheetMode] = React.useState<
    "closed" | "add" | "edit"
  >("closed");
  const [lineTargetPkgId, setLineTargetPkgId] = React.useState<string | null>(null);
  const [editingLineId, setEditingLineId] = React.useState<string | null>(null);
  const [lineForm, setLineForm] = React.useState<LineFormValues>({
    label: "",
    unit: "",
    unitType: "flat",
    qtyTiedToGuests: false,
  });
  const [lineSaving, setLineSaving] = React.useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────

  const filteredPackages = React.useMemo(() => {
    if (!search.trim()) return initialPackages;
    const q = search.toLowerCase();
    return initialPackages.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.season ?? "").toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q) ||
        p.lines.some((l: PackageLineRow) => l.label.toLowerCase().includes(q)),
    );
  }, [initialPackages, search]);

  const filteredAddOns = React.useMemo(() => {
    if (!search.trim()) return initialAddOns;
    const q = search.toLowerCase();
    return initialAddOns.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.description ?? "").toLowerCase().includes(q) ||
        item.course.toLowerCase().includes(q),
    );
  }, [initialAddOns, search]);

  const lineSheetPkgName = initialPackages.find(
    (p) => p.id === lineTargetPkgId,
  )?.name;

  // ── Handlers: packages ────────────────────────────────────────────────────

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openNewPackage() {
    setEditingPkgId(null);
    setPkgForm({ name: "", season: "Summer", description: "", fromPrice: "" });
    setPkgSheetMode("new");
  }

  function openEditPackage(pkg: PackageWithLines) {
    setEditingPkgId(pkg.id);
    setPkgForm({
      name: pkg.name,
      season: (pkg.season as Season) ?? "All year",
      description: pkg.description ?? "",
      fromPrice: String(minorToMajor(pkg.from_price_minor)),
    });
    setPkgSheetMode("edit");
  }

  async function savePackage() {
    if (!pkgForm.name.trim()) {
      toast.error("Package name is required.");
      return;
    }
    setPkgSaving(true);
    try {
      if (pkgSheetMode === "edit" && editingPkgId) {
        const result = await updatePackage({
          packageId: editingPkgId,
          name: pkgForm.name,
          season: pkgForm.season,
          description: pkgForm.description,
          fromPricePounds: pkgForm.fromPrice,
        });
        if (!result.ok) { toast.error(result.error); return; }
        toast.success("Package updated.");
      } else {
        const result = await createPackage({
          name: pkgForm.name,
          season: pkgForm.season,
          description: pkgForm.description,
          fromPricePounds: pkgForm.fromPrice,
        });
        if (!result.ok) { toast.error(result.error); return; }
        toast.success("Package added — add line items to build it out.");
        setExpandedIds((prev) => new Set([...prev, result.data.id]));
      }
      setPkgSheetMode("closed");
      router.refresh();
    } finally {
      setPkgSaving(false);
    }
  }

  async function handleArchivePackage(pkg: PackageWithLines) {
    const result = await togglePackageActive({
      packageId: pkg.id,
      isActive: !pkg.is_active,
    });
    if (!result.ok) { toast.error(result.error); return; }
    toast.success(pkg.is_active ? "Package archived." : "Package restored.");
    router.refresh();
  }

  // ── Handlers: lines ───────────────────────────────────────────────────────

  function openAddLine(pkgId: string) {
    setLineTargetPkgId(pkgId);
    setEditingLineId(null);
    setLineForm({ label: "", unit: "", unitType: "flat", qtyTiedToGuests: false });
    setLineSheetMode("add");
  }

  function openEditLine(pkgId: string, lineId: string) {
    const pkg = initialPackages.find((p) => p.id === pkgId);
    const line = pkg?.lines.find((l) => l.id === lineId);
    if (!line) return;
    setLineTargetPkgId(pkgId);
    setEditingLineId(lineId);
    setLineForm({
      label: line.label,
      unit: String(minorToMajor(line.unit_minor)),
      unitType: line.unit_type as LineFormValues["unitType"],
      qtyTiedToGuests: line.qty_tied_to_guests,
    });
    setLineSheetMode("edit");
  }

  async function saveLine() {
    if (!lineForm.label.trim()) {
      toast.error("Label is required.");
      return;
    }
    setLineSaving(true);
    try {
      if (lineSheetMode === "edit" && editingLineId) {
        const result = await updatePackageLine({
          lineId: editingLineId,
          label: lineForm.label,
          unitPounds: lineForm.unit,
          unitType: lineForm.unitType,
          qtyTiedToGuests: lineForm.qtyTiedToGuests,
        });
        if (!result.ok) { toast.error(result.error); return; }
        toast.success("Line item updated.");
      } else if (lineSheetMode === "add" && lineTargetPkgId) {
        const result = await createPackageLine({
          packageId: lineTargetPkgId,
          label: lineForm.label,
          unitPounds: lineForm.unit,
          unitType: lineForm.unitType,
          qtyTiedToGuests: lineForm.qtyTiedToGuests,
        });
        if (!result.ok) { toast.error(result.error); return; }
        toast.success("Line item added.");
      }
      setLineSheetMode("closed");
      router.refresh();
    } finally {
      setLineSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const totalCount = initialPackages.length + initialAddOns.length;
  const resultCount = filteredPackages.length + filteredAddOns.length;

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Toolbar */}
        <DataToolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search packages & add-ons…",
          }}
          resultCount={search ? resultCount : undefined}
          totalCount={search ? totalCount : undefined}
          actions={
            canManage ? (
              <Button
                variant="default"
                size="sm"
                className="gap-1.5"
                onClick={openNewPackage}
              >
                <Plus className="size-4" aria-hidden />
                Add package
              </Button>
            ) : undefined
          }
        />

        {/* Packages section */}
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
                <PackageIcon className="size-5 text-muted-foreground" aria-hidden />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-foreground">
                  {search ? "No packages match your search" : "No packages yet"}
                </p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  {search
                    ? "Try a different search term."
                    : "Add your first package to start pricing proposals for couples."}
                </p>
              </div>
              {!search && canManage && (
                <Button variant="outline" size="sm" onClick={openNewPackage}>
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
                  onArchive={() => handleArchivePackage(pkg)}
                  onAddLine={() => openAddLine(pkg.id)}
                  onEditLine={(lineId) => openEditLine(pkg.id, lineId)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Add-ons / drinks section */}
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
                  : "No evening items in the menu library yet. Add them under Menu library."}
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
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAddOns.map((item) => (
                      <AddOnRow key={item.id} item={item} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Package sheet */}
      <ControlledSheet
        open={pkgSheetMode !== "closed"}
        onOpenChange={(o) => { if (!o) setPkgSheetMode("closed"); }}
        title={pkgSheetMode === "edit" ? "Edit package" : "New package"}
        description={
          pkgSheetMode === "edit"
            ? "Update this package's name, season and base price."
            : "Name, season and base price shown to couples on enquiry."
        }
        onSave={savePackage}
        saveLabel={pkgSheetMode === "edit" ? "Save changes" : "Add package"}
        saving={pkgSaving}
      >
        <PackageForm value={pkgForm} onChange={setPkgForm} />
      </ControlledSheet>

      {/* Line item sheet */}
      <ControlledSheet
        open={lineSheetMode !== "closed"}
        onOpenChange={(o) => { if (!o) setLineSheetMode("closed"); }}
        title={lineSheetMode === "edit" ? "Edit line item" : "Add line item"}
        description={lineSheetPkgName ? `For "${lineSheetPkgName}"` : undefined}
        onSave={saveLine}
        saveLabel={lineSheetMode === "edit" ? "Save changes" : "Add line item"}
        saving={lineSaving}
      >
        <PackageLineForm value={lineForm} onChange={setLineForm} />
      </ControlledSheet>
    </>
  );
}
