"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Clock, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { updateAppointmentStatus } from "@/app/(app)/settings/availability/actions";
import type { AppointmentRow } from "./page";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatTime(utcIso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date(utcIso));
}

function formatDate(utcIso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: timezone,
  }).format(new Date(utcIso));
}

function formatDayHeader(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timezone,
  }).format(date);
}

/** Returns 0-based weekday index Mon=0 … Sun=6 for a UTC ISO string in a given tz. */
function getLocalWeekday(utcIso: string, timezone: string): number {
  const d = new Date(utcIso);
  // Parse the local date in the venue timezone, then map JS getDay() to Mon=0..Sun=6
  const localDateStr = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).format(d);
  const jsDay = new Date(localDateStr).getDay(); // 0=Sun,1=Mon,...,6=Sat
  return jsDay === 0 ? 6 : jsDay - 1;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_CHIP: Record<
  AppointmentRow["status"],
  { label: string; className: string }
> = {
  booked: {
    label: "Upcoming",
    className: "bg-fun-blue text-foreground",
  },
  attended: {
    label: "Attended",
    className: "bg-fun-green text-foreground",
  },
  no_show: {
    label: "No-show",
    className: "bg-warning text-warning-foreground",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-muted text-muted-foreground",
  },
};

function StatusBadge({ status }: { status: AppointmentRow["status"] }) {
  const { label, className } = STATUS_CHIP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        className,
      )}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Appointment card (compact, for week column)
// ---------------------------------------------------------------------------

function AppointmentCard({
  appt,
  timezone,
  onClick,
}: {
  appt: AppointmentRow;
  timezone: string;
  onClick: () => void;
}) {
  const typeLabel = appt.meetingTypeKind === "viewing" ? "Viewing" : "Call";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        appt.status === "cancelled" && "opacity-50",
      )}
    >
      <p className="truncate text-sm font-semibold text-foreground">
        {appt.contactName}
      </p>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="size-3 shrink-0" />
        <span className="tabular-nums">
          {formatTime(appt.startsAtUtc, timezone)}
        </span>
        <span className="rounded bg-muted px-1 py-0.5 font-medium text-foreground">
          {typeLabel}
        </span>
      </div>
      {appt.memberName && (
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {appt.memberName}
        </p>
      )}
      <div className="mt-2">
        <StatusBadge status={appt.status} />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Detail sheet
// ---------------------------------------------------------------------------

function AppointmentSheet({
  appt,
  timezone,
  open,
  onClose,
  onStatusChange,
}: {
  appt: AppointmentRow | null;
  timezone: string;
  open: boolean;
  onClose: () => void;
  onStatusChange: (id: string, status: "attended" | "no_show" | "cancelled") => void;
}) {
  const [busy, setBusy] = React.useState(false);

  if (!appt) return null;

  const typeLabel = appt.meetingTypeKind === "viewing" ? "Venue viewing" : "Discovery call";

  async function handleAction(status: "attended" | "no_show" | "cancelled") {
    setBusy(true);
    const result = await updateAppointmentStatus({ appointmentId: appt!.id, status });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const labels = { attended: "Marked as attended", no_show: "Marked as no-show", cancelled: "Appointment cancelled" };
    toast.success(labels[status]);
    onStatusChange(appt!.id, status);
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full max-w-sm sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-lg font-bold tracking-[-0.022em]">
            {typeLabel}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Who */}
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Contact</p>
            <p className="font-semibold text-foreground">{appt.contactName}</p>
            {appt.contactEmail && (
              <p className="text-sm text-muted-foreground">{appt.contactEmail}</p>
            )}
          </div>

          {/* When */}
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">When</p>
            <p className="font-semibold text-foreground">
              {formatDate(appt.startsAtUtc, timezone)}
            </p>
            <p className="text-sm text-muted-foreground tabular-nums">
              {formatTime(appt.startsAtUtc, timezone)} – {formatTime(appt.endsAtUtc, timezone)}
              {" · "}{timezone.replace(/_/g, " ")}
            </p>
          </div>

          {/* Staff */}
          {appt.memberName && (
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Staff</p>
              <p className="font-semibold text-foreground">{appt.memberName}</p>
            </div>
          )}

          {/* Status */}
          <div>
            <StatusBadge status={appt.status} />
          </div>

          {/* Actions — only for booked */}
          {appt.status === "booked" && (
            <div className="space-y-2 pt-2">
              <Button
                size="lg"
                className="w-full"
                disabled={busy}
                onClick={() => handleAction("attended")}
              >
                Mark as attended
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={() => handleAction("no_show")}
              >
                Mark as no-show
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full text-destructive hover:text-destructive"
                disabled={busy}
                onClick={() => handleAction("cancelled")}
              >
                Cancel appointment
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Main board
// ---------------------------------------------------------------------------

export function AppointmentsBoard({
  appointments: initialAppointments,
  weekStart: weekStartIso,
  venueTimezone,
}: {
  appointments: AppointmentRow[];
  weekStart: string;
  venueTimezone: string;
}) {
  const router = useRouter();
  const [appointments, setAppointments] =
    React.useState<AppointmentRow[]>(initialAppointments);
  const [selected, setSelected] = React.useState<AppointmentRow | null>(null);

  // Keep in sync if SSR props change (page navigation).
  // Use startTransition so the React Compiler doesn't flag synchronous setState.
  React.useEffect(() => {
    React.startTransition(() => {
      setAppointments(initialAppointments);
    });
  }, [initialAppointments]);

  const weekStart = new Date(weekStartIso);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function navigateWeek(delta: number) {
    const next = addDays(weekStart, delta * 7);
    const iso = next.toISOString().slice(0, 10);
    router.push(`/appointments?week=${iso}`);
  }

  // Group appointments by weekday index (Mon=0..Sun=6)
  const byDay = React.useMemo(() => {
    const map: Record<number, AppointmentRow[]> = {};
    for (let i = 0; i < 7; i++) map[i] = [];
    for (const appt of appointments) {
      const idx = getLocalWeekday(appt.startsAtUtc, venueTimezone);
      if (idx >= 0 && idx < 7) map[idx]!.push(appt);
    }
    return map;
  }, [appointments, venueTimezone]);

  const totalCount = appointments.filter((a) => a.status !== "cancelled").length;

  function handleStatusChange(
    id: string,
    status: "attended" | "no_show" | "cancelled",
  ) {
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a)),
    );
  }

  return (
    <>
      {/* Week nav header */}
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigateWeek(-1)}
          className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Previous week"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            {weekDays[0] &&
              new Intl.DateTimeFormat("en-GB", {
                day: "numeric",
                month: "long",
                timeZone: venueTimezone,
              }).format(weekDays[0])}{" "}
            –{" "}
            {weekDays[6] &&
              new Intl.DateTimeFormat("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: venueTimezone,
              }).format(weekDays[6])}
          </p>
          <p className="text-xs text-muted-foreground">
            {totalCount} appointment{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigateWeek(1)}
          className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Next week"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Week grid — horizontal scroll on mobile */}
      <div className="overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-7 gap-3">
          {weekDays.map((day, idx) => {
            const dayAppts = byDay[idx] ?? [];
            const isToday =
              new Date().toDateString() === day.toDateString();
            return (
              <div key={idx} className="min-h-[200px]">
                {/* Column header */}
                <div
                  className={cn(
                    "mb-2 rounded-lg px-2 py-1.5 text-center text-xs font-semibold",
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {formatDayHeader(day, venueTimezone)}
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {dayAppts.length === 0 ? (
                    <p className="px-1 text-center text-[11px] text-muted-foreground/60">
                      –
                    </p>
                  ) : (
                    dayAppts.map((appt) => (
                      <AppointmentCard
                        key={appt.id}
                        appt={appt}
                        timezone={venueTimezone}
                        onClick={() => setSelected(appt)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Empty state — no appointments at all this week */}
      {totalCount === 0 && (
        <div className="mt-12 text-center">
          <CalendarDays className="mx-auto mb-3 size-10 text-muted-foreground/40" />
          <p className="font-semibold text-foreground">No appointments this week</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Appointments appear here once couples book a viewing or call.{" "}
            <Link href="/settings/availability" className="text-primary underline-offset-2 hover:underline">
              Set up availability
            </Link>{" "}
            to start accepting bookings.
          </p>
        </div>
      )}

      {/* Detail sheet */}
      <AppointmentSheet
        appt={selected}
        timezone={venueTimezone}
        open={selected !== null}
        onClose={() => setSelected(null)}
        onStatusChange={handleStatusChange}
      />
    </>
  );
}
