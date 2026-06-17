"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Phone,
  Plus,
  Users,
  Zap,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  formatDuration,
  getNowNext,
  timeToMinutes,
  type Category,
  type TimelineEvent,
  type WeddingSupplierRef,
} from "./runsheet-types";
import {
  addEvent,
  updateEvent,
  deleteEvent,
  toggleDone,
  type AddEventInput,
  type UpdateEventInput,
} from "./actions";
import type { Tables } from "@/lib/supabase/types";

type TimelineEventRow = Tables<"timeline_events">;

// ---------------------------------------------------------------------------
// Prop types
// ---------------------------------------------------------------------------

export interface RunsheetClientProps {
  weddingId: string;
  coupleName: string;
  formattedDate: string;
  guestCount: number;
  initialEvents: TimelineEventRow[];
  initialSuppliers: Pick<
    Tables<"wedding_suppliers">,
    "id" | "name" | "contact_name" | "phone" | "checked_in_at"
  >[];
}

// ---------------------------------------------------------------------------
// Row → domain type adapter
// ---------------------------------------------------------------------------

function rowToEvent(row: TimelineEventRow): TimelineEvent {
  return {
    id: row.id,
    title: row.title,
    starts_at_time: row.starts_at_time,
    duration_min: row.duration_min,
    category: row.category as Category,
    owner: row.owner,
    notes: row.notes,
    supplier_id: row.supplier_id,
    done: row.done,
    sort_order: row.sort_order,
  };
}

// ---------------------------------------------------------------------------
// Live clock hook
// ---------------------------------------------------------------------------

function useLiveClock(): string {
  const [time, setTime] = React.useState<string>(() => {
    const now = new Date();
    return now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  });

  React.useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    }
    tick();
    const interval = setInterval(tick, 10_000);
    return () => clearInterval(interval);
  }, []);

  return time;
}

// ---------------------------------------------------------------------------
// Count board (event-day)
// ---------------------------------------------------------------------------

interface CountBoardProps {
  totalGuests: number;
  suppliersCheckedIn: number;
  totalSuppliers: number;
  itemsDone: number;
  totalItems: number;
  nextTime: string | null;
}

function CountBoard({
  totalGuests,
  suppliersCheckedIn,
  totalSuppliers,
  itemsDone,
  totalItems,
  nextTime,
}: CountBoardProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
        <div className="flex items-center gap-1.5">
          <Users className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Guests
          </span>
        </div>
        <span className="text-2xl font-bold tabular-nums leading-tight text-foreground">
          {totalGuests}
        </span>
      </div>

      <div className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
        <div className="flex items-center gap-1.5">
          <CheckCircle2
            className="size-3.5 text-fun-green-strong"
            aria-hidden
          />
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Suppliers in
          </span>
        </div>
        <span className="text-2xl font-bold tabular-nums leading-tight text-foreground">
          {suppliersCheckedIn}
          <span className="text-base font-normal text-muted-foreground">
            /{totalSuppliers}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
        <div className="flex items-center gap-1.5">
          <Zap className="size-3.5 text-warning-foreground" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Done
          </span>
        </div>
        <span className="text-2xl font-bold tabular-nums leading-tight text-foreground">
          {itemsDone}
          <span className="text-base font-normal text-muted-foreground">
            /{totalItems}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
        <div className="flex items-center gap-1.5">
          <Clock className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Next item
          </span>
        </div>
        <span className="text-2xl font-bold tabular-nums leading-tight text-foreground">
          {nextTime ?? "—"}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NOW / NEXT strip
// ---------------------------------------------------------------------------

interface NowNextStripProps {
  nowItem: TimelineEvent | null;
  nextItem: TimelineEvent | null;
  clockTime: string;
  supplierMap: Record<string, WeddingSupplierRef>;
}

function NowNextStrip({
  nowItem,
  nextItem,
  clockTime,
  supplierMap,
}: NowNextStripProps) {
  if (!nowItem && !nextItem) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {nowItem && (
        <div className="relative overflow-hidden rounded-xl border-2 border-primary/30 bg-primary/5 px-5 py-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-primary">
              Now
            </span>
            <span className="ml-auto font-mono text-2xl font-bold tabular-nums text-foreground">
              {clockTime}
            </span>
          </div>
          <p className="text-lg font-semibold leading-snug text-foreground sm:text-xl">
            {nowItem.title}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {nowItem.owner && (
              <span className="text-sm text-muted-foreground">
                {nowItem.owner}
              </span>
            )}
            {nowItem.supplier_id && supplierMap[nowItem.supplier_id] && (
              <a
                href={`tel:${supplierMap[nowItem.supplier_id].phone}`}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                aria-label={`Call ${supplierMap[nowItem.supplier_id].name}`}
              >
                <Phone className="size-3.5" aria-hidden />
                Call{" "}
                {supplierMap[nowItem.supplier_id].contact_name ??
                  supplierMap[nowItem.supplier_id].name}
              </a>
            )}
          </div>
        </div>
      )}

      {nextItem && (
        <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-xs">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Up next
            </span>
            <span className="ml-auto text-lg font-bold tabular-nums text-foreground">
              {nextItem.starts_at_time}
            </span>
          </div>
          <p className="text-base font-semibold leading-snug text-foreground">
            {nextItem.title}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {nextItem.owner && (
              <span className="text-sm text-muted-foreground">
                {nextItem.owner}
              </span>
            )}
            {nextItem.supplier_id && supplierMap[nextItem.supplier_id] && (
              <a
                href={`tel:${supplierMap[nextItem.supplier_id].phone}`}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                aria-label={`Call ${supplierMap[nextItem.supplier_id].name}`}
              >
                <Phone className="size-3.5" aria-hidden />
                Call{" "}
                {supplierMap[nextItem.supplier_id].contact_name ??
                  supplierMap[nextItem.supplier_id].name}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category filter pills
// ---------------------------------------------------------------------------

interface CategoryPillsProps {
  active: Category | "all";
  onChange: (c: Category | "all") => void;
  counts: Record<Category, number>;
}

function CategoryPills({ active, onChange, counts }: CategoryPillsProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Filter by category"
    >
      <button
        type="button"
        onClick={() => onChange("all")}
        aria-pressed={active === "all"}
        className={cn(
          "inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors",
          active === "all"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        All
      </button>
      {CATEGORY_ORDER.filter((c) => counts[c] > 0).map((cat) => {
        const meta = CATEGORY_META[cat];
        const isActive = active === cat;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(cat)}
            aria-pressed={isActive}
            className={cn(
              "inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : cn(meta.chip, "opacity-80 hover:opacity-100"),
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                isActive ? "bg-primary-foreground" : meta.dot,
              )}
            />
            {meta.label}
            <span
              className={cn(
                "ml-0.5 text-xs tabular-nums",
                isActive ? "text-primary-foreground/70" : "opacity-70",
              )}
            >
              {counts[cat]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category legend (planning mode)
// ---------------------------------------------------------------------------

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {CATEGORY_ORDER.map((cat) => {
        const meta = CATEGORY_META[cat];
        return (
          <span
            key={cat}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em]",
              meta.chip,
            )}
          >
            <span className={cn("size-1.5 rounded-full", meta.dot)} />
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Planning row (timeline view)
// ---------------------------------------------------------------------------

interface PlanningRowProps {
  item: TimelineEvent;
  isLast: boolean;
  supplier: WeddingSupplierRef | null;
  onEdit: (item: TimelineEvent) => void;
}

function PlanningRow({ item, isLast, supplier, onEdit }: PlanningRowProps) {
  const meta = CATEGORY_META[item.category];

  return (
    <div className="grid grid-cols-[72px_auto] gap-x-4 sm:grid-cols-[88px_auto]">
      {/* Left rail: time + connector line */}
      <div className="relative flex flex-col items-end pt-0.5">
        <span className="text-base font-semibold tabular-nums leading-tight text-foreground sm:text-lg">
          {item.starts_at_time}
        </span>
        {!isLast && (
          <div className="absolute bottom-[-32px] right-[-17px] top-6 w-px bg-border sm:right-[-21px]" />
        )}
      </div>

      {/* Dot + card */}
      <div className="relative pb-8">
        <div
          className={cn(
            "absolute left-[-21px] top-1.5 size-3.5 rounded-full border-2 border-card sm:left-[-25px]",
            meta.dot,
          )}
        />

        <div className="group rounded-xl border border-border bg-card px-4 py-3.5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]",
                meta.chip,
              )}
            >
              <span className={cn("size-1.5 rounded-full", meta.dot)} />
              {meta.label}
            </span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] font-medium tabular-nums text-muted-foreground">
                <Clock className="size-3" />
                {formatDuration(item.duration_min)}
              </span>
              <button
                type="button"
                onClick={() => onEdit(item)}
                aria-label={`Edit ${item.title}`}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
              >
                <Pencil className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>

          <p className="text-sm font-medium leading-snug text-foreground sm:text-[15px]">
            {item.title}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            {item.owner && (
              <span className="text-xs text-muted-foreground">
                {item.owner}
              </span>
            )}
            {supplier && (
              <a
                href={`tel:${supplier.phone}`}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                aria-label={`Call ${supplier.name}`}
              >
                <Phone className="size-3.5" aria-hidden />
                {supplier.contact_name ?? supplier.name}
              </a>
            )}
          </div>

          {item.notes && (
            <p className="mt-2 border-t border-border pt-2 text-xs leading-relaxed text-muted-foreground">
              {item.notes}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event-day check-off row
// ---------------------------------------------------------------------------

interface EventDayRowProps {
  item: TimelineEvent;
  done: boolean;
  isNow: boolean;
  isNext: boolean;
  onToggle: (id: string, done: boolean) => void;
  supplier: WeddingSupplierRef | null;
}

function EventDayRow({
  item,
  done,
  isNow,
  isNext,
  onToggle,
  supplier,
}: EventDayRowProps) {
  const meta = CATEGORY_META[item.category];

  return (
    <div
      className={cn(
        "flex min-h-[64px] items-start gap-4 rounded-xl border px-4 py-4 transition-all",
        done
          ? "border-border bg-muted/40 opacity-60"
          : isNow
            ? "border-primary/30 bg-primary/5 shadow-sm"
            : isNext
              ? "border-border bg-card shadow-xs"
              : "border-border bg-card",
      )}
    >
      {/* Check-off button — 44px tap target */}
      <button
        type="button"
        onClick={() => onToggle(item.id, !done)}
        aria-label={
          done
            ? `Mark "${item.title}" not done`
            : `Mark "${item.title}" done`
        }
        className={cn(
          "-ml-1 mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors",
          done
            ? "text-fun-green-strong hover:text-muted-foreground"
            : "text-muted-foreground/50 hover:text-fun-green-strong",
        )}
      >
        {done ? (
          <CheckCircle2 className="size-6" aria-hidden />
        ) : (
          <Circle className="size-6" aria-hidden />
        )}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "font-mono text-sm font-semibold tabular-nums",
              done ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {item.starts_at_time}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]",
              meta.chip,
            )}
          >
            <span className={cn("size-1.5 rounded-full", meta.dot)} />
            {meta.label}
          </span>
          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
            {formatDuration(item.duration_min)}
          </span>
        </div>

        <p
          className={cn(
            "text-base font-semibold leading-snug sm:text-lg",
            done
              ? "text-muted-foreground line-through decoration-muted-foreground/50"
              : "text-foreground",
          )}
        >
          {item.title}
        </p>

        <div className="mt-0.5 flex flex-wrap items-center gap-3">
          {item.owner && (
            <span className="text-sm text-muted-foreground">{item.owner}</span>
          )}
          {supplier && (
            <a
              href={`tel:${supplier.phone}`}
              className={cn(
                "inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border px-3",
                "text-sm font-medium text-foreground transition-colors hover:bg-accent",
              )}
              aria-label={`Call ${supplier.name}: ${supplier.phone}`}
            >
              <Phone className="size-3.5 shrink-0" aria-hidden />
              {supplier.contact_name ?? supplier.name}
            </a>
          )}
        </div>

        {item.notes && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {item.notes}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event sheet (add / edit)
// ---------------------------------------------------------------------------

interface EventSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weddingId: string;
  event?: TimelineEvent | null;
  suppliers: WeddingSupplierRef[];
  onSaved: (event: TimelineEvent) => void;
  onDeleted?: (id: string) => void;
}

function EventSheet({
  open,
  onOpenChange,
  weddingId,
  event,
  suppliers,
  onSaved,
  onDeleted,
}: EventSheetProps) {
  const isEdit = !!event;
  const [pending, startTransition] = React.useTransition();
  const [deleting, startDeleteTransition] = React.useTransition();

  const [title, setTitle] = React.useState(event?.title ?? "");
  const [time, setTime] = React.useState(event?.starts_at_time ?? "09:00");
  const [duration, setDuration] = React.useState(
    String(event?.duration_min ?? 30),
  );
  const [category, setCategory] = React.useState<Category>(
    event?.category ?? "ceremony",
  );
  const [owner, setOwner] = React.useState(event?.owner ?? "");
  const [notes, setNotes] = React.useState(event?.notes ?? "");
  const [supplierId, setSupplierId] = React.useState(
    event?.supplier_id ?? "",
  );

  // Reset fields when the target event changes. Render-time prop-sync keyed on
  // the event id (React's "adjust state on prop change" pattern) — avoids the
  // set-state-in-effect cascading-render lint/perf issue.
  const [prevEventId, setPrevEventId] = React.useState(event?.id);
  if (prevEventId !== event?.id) {
    setPrevEventId(event?.id);
    setTitle(event?.title ?? "");
    setTime(event?.starts_at_time ?? "09:00");
    setDuration(String(event?.duration_min ?? 30));
    setCategory(event?.category ?? "ceremony");
    setOwner(event?.owner ?? "");
    setNotes(event?.notes ?? "");
    setSupplierId(event?.supplier_id ?? "");
  }

  function handleSave() {
    startTransition(async () => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        toast.error("Title is required.");
        return;
      }

      const fields = {
        title: trimmedTitle,
        starts_at_time: time,
        duration_min: Math.max(0, parseInt(duration, 10) || 0),
        category,
        owner: owner.trim() || undefined,
        notes: notes.trim() || null,
        supplier_id: supplierId || null,
      };

      if (isEdit && event) {
        const input: UpdateEventInput = { eventId: event.id, ...fields };
        const res = await updateEvent(event.id, weddingId, input);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Event updated.");
        onSaved({ ...event, ...fields, owner: fields.owner ?? null });
      } else {
        const input: AddEventInput = { weddingId, ...fields };
        const res = await addEvent(input);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Event added.");
        onSaved({
          id: res.data.id,
          title: fields.title,
          starts_at_time: fields.starts_at_time,
          duration_min: fields.duration_min,
          category: fields.category,
          owner: fields.owner ?? null,
          notes: fields.notes ?? null,
          supplier_id: fields.supplier_id ?? null,
          done: false,
          sort_order: Date.now(),
        });
      }

      onOpenChange(false);
    });
  }

  function handleDelete() {
    if (!event) return;
    startDeleteTransition(async () => {
      const res = await deleteEvent({ eventId: event.id, weddingId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Event deleted.");
      onDeleted?.(event.id);
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit event" : "Add event"}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-4">
          <div className="space-y-1.5">
            <Label htmlFor="evt-title">Title</Label>
            <Input
              id="evt-title"
              placeholder="e.g. Bride arrives"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={pending}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="evt-time">Time</Label>
              <Input
                id="evt-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="evt-duration">Duration (min)</Label>
              <Input
                id="evt-duration"
                type="number"
                min={0}
                max={1440}
                step={5}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                disabled={pending}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evt-category">Category</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as Category)}
              disabled={pending}
            >
              <SelectTrigger id="evt-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_ORDER.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_META[cat].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="evt-owner">Owner / responsible person</Label>
            <Input
              id="evt-owner"
              placeholder="e.g. Head coordinator"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              disabled={pending}
            />
          </div>

          {suppliers.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="evt-supplier">Linked supplier</Label>
              <Select
                value={supplierId || "__none__"}
                onValueChange={(v) =>
                  setSupplierId(v === "__none__" ? "" : v)
                }
                disabled={pending}
              >
                <SelectTrigger id="evt-supplier">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="evt-notes">Notes</Label>
            <Textarea
              id="evt-notes"
              placeholder="Any notes for staff or suppliers…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={pending}
            />
          </div>
        </div>

        <SheetFooter className="flex-col gap-2 sm:flex-row">
          {isEdit && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || pending}
              className="w-full sm:w-auto"
            >
              <Trash2 className="mr-1.5 size-4" aria-hidden />
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          )}
          <SheetClose asChild>
            <Button
              type="button"
              variant="outline"
              disabled={pending || deleting}
              className="w-full sm:w-auto"
            >
              <X className="mr-1.5 size-4" aria-hidden />
              Cancel
            </Button>
          </SheetClose>
          <Button
            type="button"
            onClick={handleSave}
            disabled={pending || deleting}
            className="w-full sm:w-auto"
          >
            {pending ? "Saving…" : isEdit ? "Save changes" : "Add event"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Mode toggle
// ---------------------------------------------------------------------------

type ViewMode = "planning" | "event-day";

interface ModeToggleProps {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}

function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div
      className="flex items-center rounded-lg border border-border bg-muted p-1"
      role="group"
      aria-label="View mode"
    >
      <button
        type="button"
        onClick={() => onChange("planning")}
        aria-pressed={mode === "planning"}
        className={cn(
          "flex min-h-[36px] items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
          mode === "planning"
            ? "bg-card text-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <CalendarDays className="size-3.5" aria-hidden />
        Planning
      </button>
      <button
        type="button"
        onClick={() => onChange("event-day")}
        aria-pressed={mode === "event-day"}
        className={cn(
          "flex min-h-[36px] items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
          mode === "event-day"
            ? "bg-primary text-primary-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Zap className="size-3.5" aria-hidden />
        Event Day
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function RunsheetClient({
  weddingId,
  coupleName,
  formattedDate,
  guestCount,
  initialEvents,
  initialSuppliers,
}: RunsheetClientProps) {
  const [mode, setMode] = React.useState<ViewMode>("planning");
  const clockTime = useLiveClock();

  // Event state (optimistic list)
  const [events, setEvents] = React.useState<TimelineEvent[]>(() =>
    initialEvents
      .map(rowToEvent)
      .sort((a, b) => a.sort_order - b.sort_order),
  );

  // Done IDs (separate set for instant optimistic toggle)
  const [doneIds, setDoneIds] = React.useState<Set<string>>(
    () => new Set(initialEvents.filter((r) => r.done).map((r) => r.id)),
  );

  // Category filter for event-day mode
  const [categoryFilter, setCategoryFilter] = React.useState<Category | "all">(
    "all",
  );

  // Add/edit sheet state
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<TimelineEvent | null>(
    null,
  );

  // Supplier lookup map
  const supplierMap = React.useMemo<Record<string, WeddingSupplierRef>>(
    () => Object.fromEntries(initialSuppliers.map((s) => [s.id, s])),
    [initialSuppliers],
  );

  const supplierRefs: WeddingSupplierRef[] = React.useMemo(
    () =>
      initialSuppliers.map((s) => ({
        id: s.id,
        name: s.name,
        contact_name: s.contact_name,
        phone: s.phone,
        checked_in_at: s.checked_in_at,
      })),
    [initialSuppliers],
  );

  // NOW / NEXT derivation
  const { nowId, nextId } = React.useMemo(
    () => getNowNext(events, clockTime),
    [events, clockTime],
  );

  const nowItem = events.find((e) => e.id === nowId) ?? null;
  const nextItem = events.find((e) => e.id === nextId) ?? null;

  // Counts
  const itemsDone = doneIds.size;
  const totalItems = events.length;
  const progressPct =
    totalItems > 0 ? Math.round((itemsDone / totalItems) * 100) : 0;
  const suppliersCheckedIn = initialSuppliers.filter(
    (s) => s.checked_in_at,
  ).length;

  const categoryCounts = React.useMemo(() => {
    const counts = {} as Record<Category, number>;
    for (const cat of CATEGORY_ORDER) {
      counts[cat] = events.filter((e) => e.category === cat).length;
    }
    return counts;
  }, [events]);

  const filteredItems = React.useMemo(() => {
    if (categoryFilter === "all") return events;
    return events.filter((e) => e.category === categoryFilter);
  }, [events, categoryFilter]);

  // Sort helper: time then sort_order
  function sortedEvents(list: TimelineEvent[]): TimelineEvent[] {
    return [...list].sort((a, b) => {
      const ta = timeToMinutes(a.starts_at_time);
      const tb = timeToMinutes(b.starts_at_time);
      return ta !== tb ? ta - tb : a.sort_order - b.sort_order;
    });
  }

  // Handlers
  function openAdd() {
    setEditingEvent(null);
    setSheetOpen(true);
  }

  function openEdit(item: TimelineEvent) {
    setEditingEvent(item);
    setSheetOpen(true);
  }

  function handleSaved(saved: TimelineEvent) {
    setEvents((prev) => {
      const idx = prev.findIndex((e) => e.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return sortedEvents(next);
      }
      return sortedEvents([...prev, saved]);
    });
  }

  function handleDeleted(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setDoneIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleToggle(id: string, nextDone: boolean) {
    // Optimistic
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (nextDone) next.add(id);
      else next.delete(id);
      return next;
    });

    const item = events.find((e) => e.id === id);
    if (item) {
      toast.success(
        nextDone
          ? `Checked off: ${item.title}`
          : `Unchecked: ${item.title}`,
        { duration: 2000 },
      );
    }

    // Server write — rollback on failure
    void toggleDone({ eventId: id, weddingId, done: nextDone }).then((res) => {
      if (!res.ok) {
        toast.error(res.error);
        setDoneIds((prev) => {
          const next = new Set(prev);
          if (nextDone) next.delete(id);
          else next.add(id);
          return next;
        });
      }
    });
  }

  const addButton = (
    <Button type="button" onClick={openAdd} className="min-h-[44px]">
      <Plus className="mr-1.5 size-4" aria-hidden />
      Add event
    </Button>
  );

  const modeToggle = <ModeToggle mode={mode} onChange={setMode} />;

  // The shared EventSheet rendered in both modes
  const eventSheet = (
    <EventSheet
      open={sheetOpen}
      onOpenChange={setSheetOpen}
      weddingId={weddingId}
      event={editingEvent}
      suppliers={supplierRefs}
      onSaved={handleSaved}
      onDeleted={handleDeleted}
    />
  );

  // -------------------------------------------------------------------------
  // PLANNING MODE
  // -------------------------------------------------------------------------

  if (mode === "planning") {
    return (
      <>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          {modeToggle}
          {addButton}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
          {/* Timeline */}
          <div>
            <div className="mb-8">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Categories
              </p>
              <Legend />
            </div>

            {events.length === 0 ? (
              <div className="flex flex-col items-center rounded-xl border border-border bg-card py-16 text-center shadow-xs">
                <Clock className="mb-4 size-10 text-muted-foreground/40" />
                <p className="text-base font-semibold text-foreground">
                  No run-sheet yet
                </p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Add timed items to build the day&apos;s timeline. Your
                  coordinator can share this with suppliers.
                </p>
                <Button
                  type="button"
                  onClick={openAdd}
                  className="mt-6 min-h-[44px]"
                >
                  <Plus className="mr-1.5 size-4" aria-hidden />
                  Add first event
                </Button>
              </div>
            ) : (
              <div>
                {events.map((item, i) => (
                  <PlanningRow
                    key={item.id}
                    item={item}
                    isLast={i === events.length - 1}
                    supplier={
                      item.supplier_id
                        ? (supplierMap[item.supplier_id] ?? null)
                        : null
                    }
                    onEdit={openEdit}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-5">
            <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-xs">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Day at a glance
              </p>
              {events.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      First item
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {events[0].starts_at_time}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      Last item
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {events[events.length - 1].starts_at_time}
                    </span>
                  </div>
                  <div className="my-2 h-px bg-border" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Items by category
                  </p>
                  <div className="space-y-2">
                    {CATEGORY_ORDER.map((cat) => {
                      const count = events.filter(
                        (e) => e.category === cat,
                      ).length;
                      if (count === 0) return null;
                      const meta = CATEGORY_META[cat];
                      return (
                        <div
                          key={cat}
                          className="flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={cn("size-2 rounded-full", meta.dot)}
                            />
                            <span className="text-xs text-muted-foreground">
                              {meta.label}
                            </span>
                          </div>
                          <span className="text-xs font-semibold tabular-nums text-foreground">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No events yet.</p>
              )}
            </div>

            {/* Supplier check-in board */}
            {initialSuppliers.length > 0 && (
              <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-xs">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Suppliers ({coupleName})
                </p>
                <div className="space-y-2">
                  {initialSuppliers.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate text-xs text-foreground">
                        {s.name}
                      </span>
                      {s.checked_in_at ? (
                        <CheckCircle2
                          className="size-4 shrink-0 text-fun-green-strong"
                          aria-label="Checked in"
                        />
                      ) : (
                        <Circle
                          className="size-4 shrink-0 text-muted-foreground/40"
                          aria-label="Not checked in"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        {eventSheet}
      </>
    );
  }

  // -------------------------------------------------------------------------
  // EVENT-DAY MODE
  // -------------------------------------------------------------------------

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {modeToggle}
        {addButton}
      </div>

      {/* Count board */}
      <div className="mb-5">
        <CountBoard
          totalGuests={guestCount}
          suppliersCheckedIn={suppliersCheckedIn}
          totalSuppliers={initialSuppliers.length}
          itemsDone={itemsDone}
          totalItems={totalItems}
          nextTime={nextItem?.starts_at_time ?? null}
        />
      </div>

      {/* Progress strip */}
      <div className="mb-5 rounded-xl border border-border bg-card px-5 py-4 shadow-xs">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Day progress
          </span>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {itemsDone} / {totalItems} items
          </span>
        </div>
        <Progress
          value={progressPct}
          className="h-2"
          aria-label={`${progressPct}% complete`}
        />
        <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
          {progressPct}% complete
        </p>
      </div>

      {/* NOW / NEXT strip */}
      {(nowItem || nextItem) && (
        <div className="mb-5">
          <NowNextStrip
            nowItem={nowItem}
            nextItem={nextItem}
            clockTime={clockTime}
            supplierMap={supplierMap}
          />
        </div>
      )}

      {/* Category filter pills */}
      <div className="mb-4">
        <CategoryPills
          active={categoryFilter}
          onChange={setCategoryFilter}
          counts={categoryCounts}
        />
      </div>

      {/* Run-sheet items */}
      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-border bg-card py-12 text-center shadow-xs">
            <Clock className="mb-3 size-8 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-foreground">
              {events.length === 0
                ? "No events yet"
                : "No items in this category"}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <EventDayRow
              key={item.id}
              item={item}
              done={doneIds.has(item.id)}
              isNow={item.id === nowId}
              isNext={item.id === nextId}
              onToggle={handleToggle}
              supplier={
                item.supplier_id
                  ? (supplierMap[item.supplier_id] ?? null)
                  : null
              }
            />
          ))
        )}
      </div>

      {/* All-done celebration */}
      {itemsDone === totalItems && totalItems > 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-xl bg-fun-green/40 px-5 py-4">
          <CheckCircle2
            className="size-5 shrink-0 text-fun-green-strong"
            aria-hidden
          />
          <p className="text-sm font-semibold text-foreground">
            All {totalItems} items complete. Great work today.
          </p>
        </div>
      )}

      {eventSheet}
    </>
  );
}
