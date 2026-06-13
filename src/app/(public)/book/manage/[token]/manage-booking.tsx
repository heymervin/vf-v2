"use client";

import * as React from "react";
import { AlertCircle, Check, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  cancelAppointment,
  getAvailableSlots,
  rescheduleAppointment,
} from "@/app/(public)/book/actions";
import type { AvailableSlot } from "@/app/(public)/book/actions";

// ---------------------------------------------------------------------------
// Helpers (duplicated from booking-widget to keep files self-contained)
// ---------------------------------------------------------------------------

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatSlotDate(utcIso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: timezone,
  }).format(new Date(utcIso));
}

function formatSlotTime(utcIso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date(utcIso));
}

function formatSlotShortDate(utcIso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timezone,
  }).format(new Date(utcIso));
}

function getLocalDate(utcIso: string, timezone: string): Date {
  const d = new Date(utcIso);
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).formatToParts(d);
  const get = (t: string) =>
    parseInt(parts.find((p) => p.type === t)?.value ?? "0");
  return new Date(get("year"), get("month") - 1, get("day"));
}

// ---------------------------------------------------------------------------
// Inline slot picker (reused for reschedule flow)
// ---------------------------------------------------------------------------

function ReschedulePicker({
  venueSlug,
  meetingTypeKind,
  venueTimezone,
  // durationMinutes kept in interface for future display use
  onSelect,
  onCancel,
}: {
  venueSlug: string;
  meetingTypeKind: "viewing" | "call";
  venueTimezone: string;
  durationMinutes: number;
  onSelect: (slot: AvailableSlot) => void;
  onCancel: () => void;
}) {
  const [slots, setSlots] = React.useState<AvailableSlot[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = React.useState<AvailableSlot | null>(null);
  const [stripOffset, setStripOffset] = React.useState(0);
  const STRIP_SIZE = 5;

  React.useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await getAvailableSlots({
        venueSlug,
        meetingTypeKind,
        rangeStart: new Date().toISOString(),
        rangeEnd: addDays(new Date(), 30).toISOString(),
      });
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSlots(res.data);
    })();
  }, [venueSlug, meetingTypeKind]);

  // Group by local date
  const slotsByDay = React.useMemo(() => {
    const map = new Map<string, AvailableSlot[]>();
    for (const slot of slots) {
      const ld = getLocalDate(slot.startsAtUtc, venueTimezone);
      const key = `${ld.getFullYear()}-${ld.getMonth()}-${ld.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(slot);
    }
    return map;
  }, [slots, venueTimezone]);

  const days = Array.from(slotsByDay.keys());
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);
  // Use startTransition so the React Compiler doesn't flag synchronous setState.
  React.useEffect(() => {
    if (days.length > 0 && !selectedDay) {
      const first = days[0] ?? null;
      React.startTransition(() => {
        setSelectedDay(first);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length]);

  const visibleDays = days.slice(stripOffset, stripOffset + STRIP_SIZE);
  const slotsForDay = selectedDay ? (slotsByDay.get(selectedDay) ?? []) : [];

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertCircle className="size-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (days.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        No availability in the next 30 days. Please contact the venue directly.
      </p>
    );
  }

  function getDayLabel(key: string) {
    const list = slotsByDay.get(key);
    if (!list || list.length === 0) return "";
    return formatSlotShortDate(list[0].startsAtUtc, venueTimezone);
  }

  return (
    <div className="space-y-4">
      {/* Day strip */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={stripOffset === 0}
          onClick={() => setStripOffset((o) => Math.max(0, o - STRIP_SIZE))}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
          aria-label="Previous dates"
        >
          ‹
        </button>
        <div className="flex flex-1 gap-1">
          {visibleDays.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => { setSelectedDay(key); setSelectedSlot(null); }}
              className={cn(
                "flex-1 min-w-0 rounded-lg border px-1 py-2 text-center text-xs font-medium transition-colors min-h-[44px]",
                selectedDay === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              <span className="block truncate leading-tight">{getDayLabel(key)}</span>
              <span className="mt-0.5 block text-[10px] opacity-70">
                {slotsByDay.get(key)?.length} slots
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={stripOffset + STRIP_SIZE >= days.length}
          onClick={() => setStripOffset((o) => o + STRIP_SIZE)}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
          aria-label="Next dates"
        >
          ›
        </button>
      </div>

      {/* Time grid */}
      {selectedDay && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slotsForDay.map((slot) => {
            const isSel = selectedSlot?.startsAtUtc === slot.startsAtUtc;
            return (
              <button
                key={slot.startsAtUtc}
                type="button"
                onClick={() => setSelectedSlot(slot)}
                className={cn(
                  "rounded-lg border px-3 py-3 text-sm font-medium tabular-nums transition-colors min-h-[44px]",
                  isSel
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted",
                )}
              >
                {formatSlotTime(slot.startsAtUtc, venueTimezone)}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Times shown in {venueTimezone.replace(/_/g, " ")}
      </p>

      <div className="flex gap-3">
        <Button
          size="lg"
          className="flex-1 text-base"
          disabled={!selectedSlot}
          onClick={() => selectedSlot && onSelect(selectedSlot)}
        >
          Confirm reschedule
        </Button>
        <Button size="lg" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface ManageBookingProps {
  id: string;
  manageToken: string;
  startsAtUtc: string;
  endsAtUtc: string;
  status: "booked" | "attended" | "no_show" | "cancelled";
  venueName: string;
  venueSlug: string;
  venueTimezone: string;
  meetingTypeKind: "viewing" | "call";
  durationMinutes: number;
  contactName: string | null;
  contactEmail: string | null;
}

type View =
  | "detail"
  | "cancel-confirm"
  | "cancelled"
  | "reschedule"
  | "rescheduled";

export function ManageBooking(props: ManageBookingProps) {
  const {
    manageToken,
    startsAtUtc,
    status: initialStatus,
    venueName,
    venueSlug,
    venueTimezone,
    meetingTypeKind,
    durationMinutes,
    contactName,
    contactEmail,
  } = props;

  const [view, setView] = React.useState<View>(
    initialStatus !== "booked" ? "cancelled" : "detail",
  );
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [newSlot, setNewSlot] = React.useState<AvailableSlot | null>(null);
  const [newManageToken, setNewManageToken] = React.useState<string | null>(null);

  const typeLabel = meetingTypeKind === "viewing" ? "Venue viewing" : "Discovery call";

  // ---------------------------------------------------------------------------
  // Cancel flow
  // ---------------------------------------------------------------------------

  async function handleCancel() {
    setBusy(true);
    setError(null);
    const res = await cancelAppointment({ manageToken });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setView("cancelled");
  }

  // ---------------------------------------------------------------------------
  // Reschedule flow
  // ---------------------------------------------------------------------------

  async function handleReschedule(slot: AvailableSlot) {
    setBusy(true);
    setError(null);
    const res = await rescheduleAppointment({
      manageToken,
      newSlotStartUtc: slot.startsAtUtc,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNewSlot(slot);
    setNewManageToken(res.data.manageToken);
    setView("rescheduled");
  }

  // ---------------------------------------------------------------------------
  // Render: non-booked status (attended / no_show / already-cancelled)
  // ---------------------------------------------------------------------------

  if (
    view === "cancelled" ||
    initialStatus === "attended" ||
    initialStatus === "no_show"
  ) {
    const isPast = initialStatus === "attended" || initialStatus === "no_show";
    return (
      <div className="px-6 py-10 text-center sm:px-8">
        <div
          className={cn(
            "mx-auto mb-5 flex size-14 items-center justify-center rounded-full",
            isPast ? "bg-muted" : "bg-fun-pink",
          )}
        >
          {isPast ? (
            <Check className="size-7 text-muted-foreground" />
          ) : (
            <X className="size-7 text-foreground" />
          )}
        </div>
        <h2 className="text-xl font-bold tracking-[-0.022em] text-foreground">
          {isPast
            ? initialStatus === "attended"
              ? "Appointment attended"
              : "Marked as no-show"
            : view === "cancelled"
              ? "Booking cancelled"
              : "Booking cancelled"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {isPast
            ? `This appointment on ${formatSlotDate(startsAtUtc, venueTimezone)} has been recorded.`
            : `Your ${typeLabel.toLowerCase()} with ${venueName} has been cancelled.`}
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: successfully rescheduled
  // ---------------------------------------------------------------------------

  if (view === "rescheduled" && newSlot) {
    return (
      <div className="px-6 py-10 text-center sm:px-8">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-fun-green">
          <Check className="size-7 text-foreground" />
        </div>
        <h2 className="text-xl font-bold tracking-[-0.022em] text-foreground">
          Booking rescheduled
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your new time: {formatSlotDate(newSlot.startsAtUtc, venueTimezone)} at{" "}
          {formatSlotTime(newSlot.startsAtUtc, venueTimezone)}.
        </p>
        {newManageToken && (
          <div className="mt-6">
            <a
              href={`/book/manage/${newManageToken}`}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
            >
              View updated booking
            </a>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: cancel confirmation step
  // ---------------------------------------------------------------------------

  if (view === "cancel-confirm") {
    return (
      <div className="px-6 py-8 sm:px-8">
        <h2 className="text-xl font-bold tracking-[-0.022em] text-foreground">
          Cancel this booking?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your {typeLabel.toLowerCase()} on{" "}
          {formatSlotDate(startsAtUtc, venueTimezone)} at{" "}
          {formatSlotTime(startsAtUtc, venueTimezone)} will be cancelled. This
          cannot be undone.
        </p>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
          <Button
            size="lg"
            variant="destructive"
            className="flex-1 sm:flex-none"
            disabled={busy}
            onClick={handleCancel}
          >
            {busy ? "Cancelling…" : "Yes, cancel booking"}
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={busy}
            onClick={() => setView("detail")}
          >
            Keep booking
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: reschedule step
  // ---------------------------------------------------------------------------

  if (view === "reschedule") {
    return (
      <div className="px-6 py-8 sm:px-8">
        <h2 className="mb-1 text-xl font-bold tracking-[-0.022em] text-foreground">
          Choose a new time
        </h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Select a new slot for your {typeLabel.toLowerCase()} with {venueName}.
        </p>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <ReschedulePicker
          venueSlug={venueSlug}
          meetingTypeKind={meetingTypeKind}
          venueTimezone={venueTimezone}
          durationMinutes={durationMinutes}
          onSelect={handleReschedule}
          onCancel={() => setView("detail")}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: detail view (default)
  // ---------------------------------------------------------------------------

  return (
    <div className="px-6 py-8 sm:px-8">
      {/* Appointment summary */}
      <div className="mb-6 rounded-xl border border-border bg-muted/40 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {typeLabel}
        </p>
        <div className="mt-3 flex items-start gap-3">
          <Clock className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-semibold text-foreground">
              {formatSlotDate(startsAtUtc, venueTimezone)}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatSlotTime(startsAtUtc, venueTimezone)} · {durationMinutes}{" "}
              min · {venueTimezone.replace(/_/g, " ")}
            </p>
          </div>
        </div>
        {contactName && (
          <p className="mt-3 text-sm text-muted-foreground">
            Booked for{" "}
            <span className="font-medium text-foreground">{contactName}</span>
            {contactEmail ? ` · ${contactEmail}` : ""}
          </p>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        <Button
          size="lg"
          className="w-full text-base"
          onClick={() => setView("reschedule")}
        >
          Reschedule
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full text-base text-destructive hover:text-destructive"
          onClick={() => setView("cancel-confirm")}
        >
          Cancel booking
        </Button>
      </div>
    </div>
  );
}
