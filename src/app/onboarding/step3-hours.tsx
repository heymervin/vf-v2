"use client";

import * as React from "react";
import { finishHours } from "./actions";
import { DEFAULT_HOURS } from "./hours-defaults";
import type { HourRow } from "@/lib/zod-schemas/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// weekday int: 0=Sunday ... 6=Saturday
const WEEKDAY_LABELS: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  0: "Sun",
};

// Display order: Mon(1)..Sat(6), Sun(0)
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface Step3Props {
  venueId: string;
  initialRows?: HourRow[];
  /** Called whenever the user edits hours, so the wizard can persist state across back/forward. */
  onHoursChange?: (rows: HourRow[]) => void;
  onComplete: () => void;
  onBack: () => void;
}

export function Step3Hours({ venueId, initialRows, onHoursChange, onComplete, onBack }: Step3Props) {
  const [rows, setRows] = React.useState<HourRow[]>(
    initialRows ?? DEFAULT_HOURS,
  );
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSkipping, setIsSkipping] = React.useState(false);

  const isBusy = isSubmitting || isSkipping;

  function updateRow(weekday: number, patch: Partial<HourRow>) {
    setRows((prev) => {
      const next = prev.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r));
      onHoursChange?.(next);
      return next;
    });
  }

  function getRow(weekday: number): HourRow {
    return (
      rows.find((r) => r.weekday === weekday) ?? {
        weekday,
        open: false,
        open_time: null,
        close_time: null,
      }
    );
  }

  async function handleSave(skip?: boolean) {
    setServerError(null);
    if (skip) {
      setIsSkipping(true);
    } else {
      setIsSubmitting(true);
    }

    const result = await finishHours(venueId, skip ? "skip" : rows);

    setIsSubmitting(false);
    setIsSkipping(false);

    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    onComplete();
  }

  return (
    <div className="space-y-5">
      {serverError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1">
        {DISPLAY_ORDER.map((weekday) => {
          const row = getRow(weekday);
          return (
            <div
              key={weekday}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors",
                row.open ? "bg-muted/40" : "opacity-60",
              )}
            >
              {/* Day label */}
              <span className="w-8 shrink-0 text-sm font-medium text-foreground">
                {WEEKDAY_LABELS[weekday]}
              </span>

              {/* Toggle */}
              <Switch
                id={`switch-${weekday}`}
                checked={row.open}
                onCheckedChange={(checked) => {
                  updateRow(weekday, {
                    open: checked,
                    open_time: checked ? "09:00" : null,
                    close_time: checked ? "17:00" : null,
                  });
                }}
                disabled={isBusy}
                aria-label={`${WEEKDAY_LABELS[weekday]} open`}
              />

              {/* Time inputs */}
              {row.open ? (
                <div className="flex items-center gap-2">
                  <Label htmlFor={`open-${weekday}`} className="sr-only">
                    Open time
                  </Label>
                  <Input
                    id={`open-${weekday}`}
                    type="time"
                    value={row.open_time ?? "09:00"}
                    onChange={(e) => updateRow(weekday, { open_time: e.target.value })}
                    disabled={isBusy}
                    className="w-28"
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Label htmlFor={`close-${weekday}`} className="sr-only">
                    Close time
                  </Label>
                  <Input
                    id={`close-${weekday}`}
                    type="time"
                    value={row.close_time ?? "17:00"}
                    onChange={(e) => updateRow(weekday, { close_time: e.target.value })}
                    disabled={isBusy}
                    className="w-28"
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Closed</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="ghost"
          disabled={isBusy}
          onClick={onBack}
        >
          Back
        </Button>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={isBusy}
            onClick={() => handleSave(true)}
            className="text-muted-foreground"
          >
            {isSkipping ? "Saving..." : "Skip for now"}
          </Button>

          <Button
            type="button"
            disabled={isBusy}
            onClick={() => handleSave(false)}
            className="min-w-28"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </span>
            ) : (
              "Finish setup"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
