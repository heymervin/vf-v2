"use client";

import * as React from "react";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { getAvailableSlots, bookSlot } from "@/app/(public)/book/actions";
import type { AvailableSlot } from "@/app/(public)/book/actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Format a UTC ISO string to a display date in the venue's timezone. */
function formatSlotDate(utcIso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timezone,
  }).format(new Date(utcIso));
}

/** Format a UTC ISO string to a time-only string in the venue's timezone. */
function formatSlotTime(utcIso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date(utcIso));
}

/** Get local date parts from a UTC ISO string in the venue timezone. */
function getLocalDate(utcIso: string, timezone: string): Date {
  const d = new Date(utcIso);
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).formatToParts(d);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0");
  return new Date(get("year"), get("month") - 1, get("day"));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = "date" | "time" | "details" | "success";

interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  website: string; // honeypot
}

const EMPTY_FORM: FormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  website: "",
};

// ---------------------------------------------------------------------------
// Slot grid — groups slots by day and shows a time grid for the selected day
// ---------------------------------------------------------------------------

function SlotGrid({
  slots,
  selectedSlot,
  venueTimezone,
  onSelect,
}: {
  slots: AvailableSlot[];
  selectedSlot: AvailableSlot | null;
  venueTimezone: string;
  onSelect: (slot: AvailableSlot) => void;
}) {
  // Group slots by local date
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

  // Day strip navigation — show up to 7 days at a time
  const [stripOffset, setStripOffset] = React.useState(0);
  const STRIP_SIZE = 7;
  const visibleDays = days.slice(stripOffset, stripOffset + STRIP_SIZE);

  // Selected day
  const [selectedDay, setSelectedDay] = React.useState<string | null>(
    days[0] ?? null,
  );

  // When slots change (re-fetch), reset to first available day.
  // Use startTransition so the React Compiler doesn't flag synchronous setState.
  React.useEffect(() => {
    const first = days[0] ?? null;
    React.startTransition(() => {
      setSelectedDay(first);
      setStripOffset(0);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  const slotsForDay = selectedDay ? (slotsByDay.get(selectedDay) ?? []) : [];

  if (days.length === 0) {
    return (
      <div className="py-12 text-center">
        <Clock className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">No availability in the next 30 days</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Please contact the venue directly to arrange a time.
        </p>
      </div>
    );
  }

  function getDayLabel(key: string) {
    const list = slotsByDay.get(key);
    if (!list || list.length === 0) return "";
    return formatSlotDate(list[0].startsAtUtc, venueTimezone);
  }

  return (
    <div className="space-y-5">
      {/* Day strip */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Select a date
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={stripOffset === 0}
            onClick={() => setStripOffset((o) => Math.max(0, o - STRIP_SIZE))}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
            aria-label="Previous dates"
          >
            <ChevronLeft className="size-4" />
          </button>

          <div className="flex flex-1 gap-1 overflow-hidden">
            {visibleDays.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDay(key)}
                className={cn(
                  "flex-1 min-w-0 rounded-lg border px-1 py-2 text-center text-xs font-medium transition-colors",
                  "min-h-[44px]",
                  selectedDay === key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted",
                )}
                aria-pressed={selectedDay === key}
                aria-label={getDayLabel(key)}
              >
                <span className="block truncate leading-tight">{getDayLabel(key)}</span>
                <span className="mt-0.5 block text-[10px] opacity-70">
                  {slotsByDay.get(key)?.length ?? 0} slots
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={stripOffset + STRIP_SIZE >= days.length}
            onClick={() => setStripOffset((o) => o + STRIP_SIZE)}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
            aria-label="Next dates"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Time grid */}
      {selectedDay && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Available times · {getDayLabel(selectedDay)}
          </p>
          <div
            className="grid grid-cols-3 gap-2 sm:grid-cols-4"
            role="listbox"
            aria-label="Available times"
          >
            {slotsForDay.map((slot) => {
              const isSelected = selectedSlot?.startsAtUtc === slot.startsAtUtc;
              return (
                <button
                  key={slot.startsAtUtc}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => onSelect(slot)}
                  className={cn(
                    "rounded-lg border px-3 py-3 text-sm font-medium tabular-nums transition-colors min-h-[44px]",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-muted",
                  )}
                >
                  {formatSlotTime(slot.startsAtUtc, venueTimezone)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Details form
// ---------------------------------------------------------------------------

function DetailsForm({
  values,
  onChange,
  errors,
}: {
  values: FormValues;
  onChange: (v: Partial<FormValues>) => void;
  errors: Partial<Record<keyof FormValues, string>>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bk-firstName" className={cn("text-base", errors.firstName && "text-destructive")}>
            Your name <span className="text-destructive" aria-hidden>*</span>
          </Label>
          <Input
            id="bk-firstName"
            className="text-base"
            autoComplete="given-name"
            value={values.firstName}
            onChange={(e) => onChange({ firstName: e.target.value })}
            aria-invalid={!!errors.firstName}
          />
          {errors.firstName && (
            <p className="text-sm text-destructive">{errors.firstName}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bk-lastName" className="text-base">Last name</Label>
          <Input
            id="bk-lastName"
            className="text-base"
            autoComplete="family-name"
            value={values.lastName}
            onChange={(e) => onChange({ lastName: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bk-email" className={cn("text-base", errors.email && "text-destructive")}>
          Email <span className="text-destructive" aria-hidden>*</span>
        </Label>
        <Input
          id="bk-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          className="text-base"
          value={values.email}
          onChange={(e) => onChange({ email: e.target.value })}
          aria-invalid={!!errors.email}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bk-phone" className="text-base">Phone (optional)</Label>
        <Input
          id="bk-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className="text-base"
          value={values.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
        />
      </div>

      {/* Honeypot */}
      <div aria-hidden className="absolute left-[-9999px] top-[-9999px]" tabIndex={-1}>
        <label>
          Leave this empty
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={values.website}
            onChange={(e) => onChange({ website: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main widget
// ---------------------------------------------------------------------------

export function BookingWidget({
  venueSlug,
  venueName,
  venueTimezone,
  meetingTypeKind,
  durationMinutes,
}: {
  venueSlug: string;
  venueName: string;
  venueTimezone: string;
  meetingTypeKind: "viewing" | "call";
  durationMinutes: number;
}) {
  const [step, setStep] = React.useState<Step>("date");
  const [slots, setSlots] = React.useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = React.useState(false);
  const [slotsError, setSlotsError] = React.useState<string | null>(null);

  const [selectedSlot, setSelectedSlot] = React.useState<AvailableSlot | null>(null);
  const [form, setForm] = React.useState<FormValues>(EMPTY_FORM);
  const [formErrors, setFormErrors] = React.useState<Partial<Record<keyof FormValues, string>>>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [manageToken, setManageToken] = React.useState<string>("");
  const [slotTaken, setSlotTaken] = React.useState(false);

  // Load slots on mount
  React.useEffect(() => {
    void loadSlots();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSlots() {
    setLoadingSlots(true);
    setSlotsError(null);
    const rangeStart = new Date().toISOString();
    const rangeEnd = addDays(new Date(), 30).toISOString();
    const result = await getAvailableSlots({
      venueSlug,
      meetingTypeKind,
      rangeStart,
      rangeEnd,
    });
    setLoadingSlots(false);
    if (!result.ok) {
      setSlotsError(result.error);
      return;
    }
    setSlots(result.data);
  }

  function validateForm(): boolean {
    const errs: Partial<Record<keyof FormValues, string>> = {};
    if (!form.firstName.trim()) errs.firstName = "Please tell us your name.";
    if (!form.email.trim()) errs.email = "We need your email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Enter a valid email address.";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleConfirm() {
    if (!selectedSlot) return;
    if (!validateForm()) return;

    setSubmitting(true);
    setServerError(null);
    setSlotTaken(false);

    const result = await bookSlot({
      venueSlug,
      meetingTypeKind,
      slotStartUtc: selectedSlot.startsAtUtc,
      firstName: form.firstName,
      lastName: form.lastName || undefined,
      email: form.email,
      phone: form.phone || undefined,
      website: form.website || undefined,
    });

    setSubmitting(false);

    if (!result.ok) {
      // Slot taken — refresh slots, keep form values
      if (result.error.toLowerCase().includes("just taken")) {
        setSlotTaken(true);
        setSelectedSlot(null);
        setStep("date");
        void loadSlots();
        return;
      }
      setServerError(result.error);
      return;
    }

    setManageToken(result.data.manageToken);
    setStep("success");
  }

  // ---------------------------------------------------------------------------
  // Step: date/time picker
  // ---------------------------------------------------------------------------

  if (step === "date") {
    return (
      <div className="px-6 py-8 sm:px-8">
        {slotTaken && (
          <Alert className="mb-5">
            <AlertCircle className="size-4" />
            <AlertDescription>
              That slot was just taken by someone else. Please choose another time.
            </AlertDescription>
          </Alert>
        )}

        {slotsError && (
          <Alert variant="destructive" className="mb-5">
            <AlertCircle className="size-4" />
            <AlertDescription>{slotsError}</AlertDescription>
          </Alert>
        )}

        {loadingSlots ? (
          <div className="space-y-3">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="flex gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 flex-1 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-11 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          </div>
        ) : (
          <SlotGrid
            slots={slots}
            selectedSlot={selectedSlot}
            venueTimezone={venueTimezone}
            onSelect={(slot) => {
              setSelectedSlot(slot);
            }}
          />
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          Times shown in {venueTimezone.replace(/_/g, " ")}
        </p>

        <div className="mt-6">
          <Button
            size="lg"
            className="w-full text-base"
            disabled={!selectedSlot || loadingSlots}
            onClick={() => setStep("details")}
          >
            Continue
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Step: details form
  // ---------------------------------------------------------------------------

  if (step === "details") {
    return (
      <div className="px-6 py-8 sm:px-8">
        {/* Selected slot summary */}
        {selectedSlot && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
            <Clock className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {formatSlotDate(selectedSlot.startsAtUtc, venueTimezone)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatSlotTime(selectedSlot.startsAtUtc, venueTimezone)} ·{" "}
                {durationMinutes} min ·{" "}
                {venueTimezone.replace(/_/g, " ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep("date")}
              className="ml-auto shrink-0 text-xs text-primary underline-offset-2 hover:underline"
            >
              Change
            </button>
          </div>
        )}

        {serverError && (
          <Alert variant="destructive" className="mb-5">
            <AlertCircle className="size-4" />
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <h2 className="mb-5 text-xl font-bold tracking-[-0.022em] text-foreground">
          Your details
        </h2>

        <DetailsForm
          values={form}
          onChange={(v) => setForm((prev) => ({ ...prev, ...v }))}
          errors={formErrors}
        />

        <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
          <Button
            size="lg"
            className="flex-1 text-base sm:flex-none sm:w-auto"
            disabled={submitting}
            onClick={handleConfirm}
          >
            {submitting ? "Confirming…" : "Confirm booking"}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="text-base"
            disabled={submitting}
            onClick={() => setStep("date")}
          >
            Back
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          We&apos;ll only use your details to confirm this appointment.
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Step: success
  // ---------------------------------------------------------------------------

  return (
    <div className="animate-in fade-in px-6 py-12 text-center duration-500 sm:px-8">
      <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-fun-green">
        <Check className="size-7 text-foreground" />
      </div>
      <h2 className="text-2xl font-bold tracking-[-0.022em] text-foreground">
        You&apos;re booked in
      </h2>
      {selectedSlot && (
        <p className="mx-auto mt-3 max-w-sm text-base leading-relaxed text-muted-foreground">
          {formatSlotDate(selectedSlot.startsAtUtc, venueTimezone)} at{" "}
          {formatSlotTime(selectedSlot.startsAtUtc, venueTimezone)} with{" "}
          {venueName}.
        </p>
      )}
      <p className="mt-2 text-sm text-muted-foreground">
        A confirmation has been sent to{" "}
        <span className="font-medium text-foreground">{form.email}</span>.
      </p>
      {manageToken && (
        <div className="mt-6">
          <a
            href={`/book/manage/${manageToken}`}
            className="inline-flex min-h-[44px] items-center rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            Manage your booking
          </a>
        </div>
      )}
    </div>
  );
}
