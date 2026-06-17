"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
  Send,
  Eye,
  ArrowLeft,
  Package,
  UtensilsCrossed,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProposalStatusBadge } from "@/components/status-badges";

import { formatMinor } from "@/lib/money/proposal";
import { computeProposalTotals } from "@/lib/money/proposal";
import { saveProposalDraft, sendProposal } from "./actions";
import type {
  ProposalRow,
  ProposalLineItemRow,
  PriceLibraryPackage,
  MenuItemRow,
} from "./actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProposalStatus = "draft" | "sent" | "viewed" | "accepted" | "expired";

interface LineItemDraft {
  _localId: string;
  label: string;
  qty: number;
  unit_minor: number;
  unit_type: string;
  category: string;
  qty_tied_to_guests: boolean;
  discount_pct: number | null;
  package_line_id: string | null;
  sort_order: number;
}

interface DiscountState {
  type: "percentage" | "fixed" | null;
  valueMinor: number | null;
}

export interface ProposalBuilderProps {
  proposal: ProposalRow;
  lineItems: ProposalLineItemRow[];
  packages: PriceLibraryPackage[];
  menuItems: MenuItemRow[];
  wedding: { couple_names: string; wedding_date: string | null; guest_count_day: number | null } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _localCounter = 0;
function nextLocalId() {
  return `loc_${++_localCounter}`;
}

function lineItemFromDb(row: ProposalLineItemRow): LineItemDraft {
  return {
    _localId: nextLocalId(),
    label: row.label,
    qty: row.qty,
    unit_minor: row.unit_minor,
    unit_type: row.unit_type,
    category: row.category,
    qty_tied_to_guests: row.qty_tied_to_guests,
    discount_pct: row.discount_pct ?? null,
    package_line_id: row.package_line_id ?? null,
    sort_order: row.sort_order,
  };
}

// ---------------------------------------------------------------------------
// QtyStepper
// ---------------------------------------------------------------------------

function QtyStepper({ value, onChange, min = 1 }: { value: number; onChange: (v: number) => void; min?: number }) {
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
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n) && n >= min) onChange(n);
        }}
        className="h-7 w-14 text-center text-sm tabular-nums px-1"
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
  );
}

// ---------------------------------------------------------------------------
// LineItemEditor
// ---------------------------------------------------------------------------

function LineItemEditor({
  lines,
  guestCount,
  onLinesChange,
  onOpenLibrary,
}: {
  lines: LineItemDraft[];
  guestCount: number | null;
  onLinesChange: (lines: LineItemDraft[]) => void;
  onOpenLibrary: () => void;
}) {
  function updateLine(localId: string, patch: Partial<LineItemDraft>) {
    onLinesChange(lines.map((l) => (l._localId === localId ? { ...l, ...patch } : l)));
  }

  function removeLine(localId: string) {
    onLinesChange(lines.filter((l) => l._localId !== localId));
  }

  function toggleGuestTie(line: LineItemDraft) {
    const tying = !line.qty_tied_to_guests;
    updateLine(line._localId, {
      qty_tied_to_guests: tying,
      qty: tying && guestCount ? guestCount : line.qty,
    });
  }

  const packageLines = lines.filter((l) => l.category === "package");
  const addonLines = lines.filter((l) => l.category !== "package");

  function renderGroup(group: LineItemDraft[], groupLabel: string) {
    if (group.length === 0) return null;
    return (
      <div className="mb-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {groupLabel}
        </p>
        <div className="space-y-1">
          {group.map((line) => {
            const lineAmt = line.qty * line.unit_minor;
            return (
              <div
                key={line._localId}
                className="group/row flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 hover:border-border/80 hover:bg-accent/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground leading-snug truncate">
                    {line.label}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatMinor(line.unit_minor)}{" "}
                    {line.unit_type ? `/ ${line.unit_type.replace(/_/g, " ")}` : ""}
                  </p>
                </div>

                <button
                  type="button"
                  title={line.qty_tied_to_guests ? "Tied to guest count — click to untie" : "Tie qty to guest count"}
                  onClick={() => toggleGuestTie(line)}
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors",
                    line.qty_tied_to_guests
                      ? "border-primary/50 bg-fun-blue text-fun-blue-strong"
                      : "border-border bg-card text-muted-foreground hover:bg-muted",
                  )}
                  aria-label={line.qty_tied_to_guests ? "Tied to guest count" : "Tie to guest count"}
                  aria-pressed={line.qty_tied_to_guests}
                >
                  <Users className="size-3.5" />
                </button>

                <QtyStepper
                  value={line.qty}
                  onChange={(v) => updateLine(line._localId, { qty: v })}
                />

                <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                  {formatMinor(lineAmt)}
                </span>

                <button
                  type="button"
                  aria-label={`Remove ${line.label}`}
                  onClick={() => removeLine(line._localId)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover/row:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
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
          {renderGroup(packageLines, "Package")}
          {renderGroup(addonLines, "Add-ons")}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PriceLibraryPicker
// ---------------------------------------------------------------------------

function PriceLibraryPicker({
  open,
  onClose,
  packages,
  menuItems,
  guestCount,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  packages: PriceLibraryPackage[];
  menuItems: MenuItemRow[];
  guestCount: number | null;
  onAdd: (item: LineItemDraft) => void;
}) {
  function addPackageLine(pkg: PriceLibraryPackage, line: import("./actions").PackageLineRow) {
    const defaultQty = line.qty_tied_to_guests ? (guestCount ?? 1) : 1;
    onAdd({
      _localId: nextLocalId(),
      label: `${pkg.name} — ${line.label}`,
      qty: defaultQty,
      unit_minor: line.unit_minor,
      unit_type: line.unit_type,
      category: "package",
      qty_tied_to_guests: line.qty_tied_to_guests,
      discount_pct: null,
      package_line_id: line.id,
      sort_order: 0,
    });
    onClose();
  }

  function addMenuItem(item: MenuItemRow) {
    onAdd({
      _localId: nextLocalId(),
      label: item.name,
      qty: guestCount ?? 1,
      unit_minor: item.price_per_head_minor ?? 0,
      unit_type: "per_head",
      category: "addon",
      qty_tied_to_guests: true,
      discount_pct: null,
      package_line_id: null,
      sort_order: 0,
    });
    onClose();
  }

  const hasPackages = packages.some((p) => p.lines.length > 0);
  const hasMenuItems = menuItems.length > 0;

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

            {hasPackages &&
              packages.map((pkg, pi) => {
                if (pkg.lines.length === 0) return null;
                return (
                  <React.Fragment key={pkg.id}>
                    {pi > 0 && <CommandSeparator />}
                    <CommandGroup heading={`Package: ${pkg.name}`}>
                      {pkg.lines.map((line) => (
                        <CommandItem
                          key={line.id}
                          value={`${pkg.name} ${line.label}`}
                          onSelect={() => addPackageLine(pkg, line)}
                          className="flex items-start gap-3 py-2.5 cursor-pointer"
                        >
                          <Package className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground leading-snug">
                              {line.label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {line.unit_type.replace(/_/g, " ")}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold tabular-nums text-foreground">
                              {formatMinor(line.unit_minor)}
                            </p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </React.Fragment>
                );
              })}

            {hasMenuItems && (
              <>
                {hasPackages && <CommandSeparator />}
                <CommandGroup heading="Menu items">
                  {menuItems.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`${item.name} ${item.course}`}
                      onSelect={() => addMenuItem(item)}
                      className="flex items-start gap-3 py-2.5 cursor-pointer"
                    >
                      <UtensilsCrossed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground leading-snug">
                          {item.name}
                        </p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums text-foreground">
                          {formatMinor(item.price_per_head_minor ?? 0)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">per head</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// CommercialSummary
// ---------------------------------------------------------------------------

function CommercialSummary({
  lines,
  discount,
  depositPct,
  onDiscountChange,
  onDepositPctChange,
}: {
  lines: LineItemDraft[];
  discount: DiscountState;
  depositPct: number;
  onDiscountChange: (d: DiscountState) => void;
  onDepositPctChange: (v: number) => void;
}) {
  const { subtotalMinor, discountMinor, totalMinor } = computeProposalTotals(
    lines.map((l) => ({ qty: l.qty, unit_minor: l.unit_minor, discount_pct: l.discount_pct })),
    { discount_type: discount.type, discount_value_minor: discount.valueMinor },
  );

  const depositMinor = Math.round(totalMinor * (depositPct / 100));

  const [discountInput, setDiscountInput] = React.useState(
    discount.valueMinor != null ? (discount.type === "fixed" ? String(discount.valueMinor / 100) : String(discount.valueMinor)) : "",
  );
  const [discountType, setDiscountType] = React.useState<"percentage" | "fixed">(
    discount.type ?? "percentage",
  );

  function applyDiscountInput() {
    const v = parseFloat(discountInput);
    if (!isNaN(v) && v > 0) {
      onDiscountChange({
        type: discountType,
        valueMinor: discountType === "fixed" ? Math.round(v * 100) : Math.round(v),
      });
    } else {
      onDiscountChange({ type: null, valueMinor: null });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Commercial summary
        </p>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums font-medium text-foreground">
              {formatMinor(subtotalMinor)}
            </span>
          </div>

          {discountMinor > 0 && (
            <div className="flex justify-between text-fun-green-strong">
              <span>
                Discount (
                {discount.type === "fixed"
                  ? formatMinor(discount.valueMinor ?? 0)
                  : `${discount.valueMinor ?? 0}%`}
                )
              </span>
              <span className="tabular-nums">−{formatMinor(discountMinor)}</span>
            </div>
          )}

          <Separator />

          <div className="flex justify-between text-base font-bold">
            <span className="text-foreground">Total</span>
            <span className="tabular-nums text-foreground">{formatMinor(totalMinor)}</span>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Discount
        </p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setDiscountType("percentage")}
            className={cn(
              "rounded-md px-2.5 py-1 text-sm font-medium transition-colors border",
              discountType === "percentage"
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
            placeholder={discountType === "percentage" ? "e.g. 5" : "e.g. 500"}
            value={discountInput}
            onChange={(e) => setDiscountInput(e.target.value)}
            onBlur={applyDiscountInput}
            onKeyDown={(e) => e.key === "Enter" && applyDiscountInput()}
            className="h-8 flex-1 text-sm"
            aria-label="Discount amount"
          />
          {discount.type != null && (
            <button
              type="button"
              aria-label="Remove discount"
              onClick={() => {
                setDiscountInput("");
                onDiscountChange({ type: null, valueMinor: null });
              }}
              className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <Separator />

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
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 10 && v <= 100) onDepositPctChange(v);
            }}
            className="h-8 w-20 text-sm tabular-nums"
            aria-label="Deposit percentage"
          />
          <span className="text-sm text-muted-foreground">%</span>
          <span className="ml-auto text-sm font-semibold tabular-nums text-foreground">
            {formatMinor(depositMinor)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProposalBuilder (main)
// ---------------------------------------------------------------------------

export function ProposalBuilder({
  proposal,
  lineItems,
  packages,
  menuItems,
  wedding,
}: ProposalBuilderProps) {
  const [lines, setLines] = React.useState<LineItemDraft[]>(
    lineItems.map(lineItemFromDb),
  );
  const [discount, setDiscount] = React.useState<DiscountState>({
    type: (proposal.discount_type as "percentage" | "fixed" | null) ?? null,
    valueMinor: proposal.discount_value_minor ?? null,
  });
  const [depositPct, setDepositPct] = React.useState(proposal.deposit_pct);
  const [status, setStatus] = React.useState<ProposalStatus>(
    proposal.status as ProposalStatus,
  );
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const guestCount = wedding?.guest_count_day ?? null;
  const coupleName = wedding?.couple_names ?? "Draft proposal";

  // Keyboard shortcut: Cmd+K opens library picker
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPickerOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function handleSaveDraft() {
    setSaving(true);
    const result = await saveProposalDraft({
      proposalId: proposal.id,
      discountType: discount.type,
      discountValueMinor: discount.valueMinor,
      depositPct,
      vatPct: proposal.vat_pct ?? null,
      notes: proposal.notes ?? null,
      lineItems: lines.map((l, idx) => ({ ...l, sort_order: idx })),
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Draft saved");
  }

  async function handleSend() {
    if (lines.length === 0) {
      toast.error("Add at least one line item before sending.");
      return;
    }

    // Save first, then mark sent
    setSending(true);
    const saveResult = await saveProposalDraft({
      proposalId: proposal.id,
      discountType: discount.type,
      discountValueMinor: discount.valueMinor,
      depositPct,
      vatPct: proposal.vat_pct ?? null,
      notes: proposal.notes ?? null,
      lineItems: lines.map((l, idx) => ({ ...l, sort_order: idx })),
    });

    if (!saveResult.ok) {
      setSending(false);
      toast.error(saveResult.error);
      return;
    }

    const sendResult = await sendProposal({ proposalId: proposal.id });
    setSending(false);

    if (!sendResult.ok) {
      toast.error(sendResult.error);
      return;
    }

    setStatus("sent");
    toast.success("Proposal marked as sent", {
      description: "Update the status to 'viewed' or 'accepted' when the couple responds.",
    });
  }

  const { totalMinor } = computeProposalTotals(
    lines.map((l) => ({ qty: l.qty, unit_minor: l.unit_minor, discount_pct: l.discount_pct })),
    { discount_type: discount.type, discount_value_minor: discount.valueMinor },
  );

  return (
    <>
      {/* Top bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/money">
              <ArrowLeft className="size-3.5" />
              Back
            </Link>
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{coupleName}</span>
            <ProposalStatusBadge status={status} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:block text-sm text-muted-foreground tabular-nums">
            {formatMinor(totalMinor)}
          </span>
          <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={saving || sending}>
            {saving ? "Saving…" : "Save draft"}
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={lines.length === 0 || status === "accepted" || saving || sending}
          >
            <Send className="size-3.5" />
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>

      {/* Three-pane workspace */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        {/* LEFT — Line-item editor */}
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm font-semibold text-foreground">
                Line items
                {guestCount != null && (
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

            {lines.length > 0 && (
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <span className="text-sm text-muted-foreground">
                  {lines.length} item{lines.length !== 1 ? "s" : ""}
                </span>
                <span className="text-sm font-bold tabular-nums text-foreground">
                  Subtotal:{" "}
                  {formatMinor(
                    lines.reduce((s, l) => s + l.qty * l.unit_minor, 0),
                  )}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT — Commercial summary */}
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
        packages={packages}
        menuItems={menuItems}
        guestCount={guestCount}
        onAdd={(item) => {
          setLines((prev) => [...prev, item]);
          toast.success(`Added: ${item.label}`);
        }}
      />
    </>
  );
}
