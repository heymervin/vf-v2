"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { venueProfileSchema, type VenueProfileInput, type VenueHourRow } from "@/lib/zod-schemas/settings-venue";
import { saveVenueProfile, saveVenueHours, removeVenueLogo } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TimezoneCombobox } from "@/app/onboarding/timezone-combobox";
import { VenueMonogram } from "@/components/layout/venue-monogram";
import { AlertCircle, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2 MB

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

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VenueFormProps {
  initialName: string;
  initialSlug: string;
  initialTimezone: string;
  /** Public URL of the existing logo, if set. */
  initialLogoUrl: string | null;
  initialHours: VenueHourRow[];
  canManage: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VenueForm({
  initialName,
  initialSlug,
  initialTimezone,
  initialLogoUrl,
  initialHours,
  canManage,
}: VenueFormProps) {
  const router = useRouter();

  // --- Venue profile state ---
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = React.useState<string | null>(initialLogoUrl);
  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = React.useState(
    !!initialSlug && initialSlug !== nameToSlug(initialName),
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<VenueProfileInput>({
    resolver: zodResolver(venueProfileSchema),
    defaultValues: {
      name: initialName,
      slug: initialSlug,
      timezone: initialTimezone,
    },
  });

  const watchedName = watch("name");
  const watchedSlug = watch("slug");
  const watchedTimezone = watch("timezone");

  // Auto-generate slug from name unless manually edited
  React.useEffect(() => {
    if (!slugManuallyEdited) {
      const generated = nameToSlug(watchedName);
      if (generated) setValue("slug", generated, { shouldValidate: false });
    }
  }, [watchedName, slugManuallyEdited, setValue]);

  // --- Hours state ---
  const [hours, setHours] = React.useState<VenueHourRow[]>(initialHours);
  const [hoursSaving, setHoursSaving] = React.useState(false);

  // ---------------------------------------------------------------------------
  // Logo helpers
  // ---------------------------------------------------------------------------

  function validateAndSetLogoFile(file: File): boolean {
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      toast.error("Logo must be a PNG, JPG, or WebP image.");
      return false;
    }
    if (file.size > MAX_LOGO_SIZE) {
      toast.error("Logo must be 2 MB or smaller.");
      return false;
    }
    return true;
  }

  function handleLogoFile(file: File) {
    if (!validateAndSetLogoFile(file)) return;
    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
  }

  function handleDropzoneDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleLogoFile(file);
  }

  function removeLogo() {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
    setLogoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    // If there was an existing logo on the server, mark it for removal
    if (existingLogoUrl) {
      setExistingLogoUrl(null);
    }
  }

  // The displayed logo: new preview > existing server URL > nothing
  const displayLogo = logoPreview ?? existingLogoUrl;

  // ---------------------------------------------------------------------------
  // Profile submit
  // ---------------------------------------------------------------------------

  async function onSubmitProfile(values: VenueProfileInput) {
    setServerError(null);

    // If the user cleared the logo (no existing + no new file), remove it first
    // before saving the rest of the profile. removeVenueLogo is the authoritative
    // action for nulling logo_path — saveVenueProfile never reads a "removeLogo" flag.
    const wantsRemoval = !existingLogoUrl && !logoFile;
    if (wantsRemoval) {
      const removeResult = await removeVenueLogo();
      if (!removeResult.ok) {
        setServerError(removeResult.error);
        return;
      }
    }

    const fd = new FormData();
    fd.set("name", values.name);
    fd.set("slug", values.slug);
    fd.set("timezone", values.timezone);
    if (logoFile) fd.set("logo", logoFile);

    const result = await saveVenueProfile(fd);

    if (!result.ok) {
      if (result.error === "SLUG_TAKEN") {
        setServerError("That web address is already taken — try another.");
      } else if (result.error === "SLUG_FORMAT") {
        setServerError(
          "Web address can only contain lowercase letters, numbers, and hyphens (3–50 characters).",
        );
      } else {
        setServerError(result.error);
      }
      return;
    }

    if (result.data.logoError) {
      toast.warning("Venue saved, but the logo couldn't be uploaded. Try again.");
    } else {
      toast.success("Venue profile saved.");
    }

    if (logoFile) {
      // Logo was just uploaded. Keep the blob preview visible so the user sees
      // their logo immediately rather than reverting to the monogram. Then
      // refresh so the server-issued signed URL replaces the blob.
      router.refresh();
    }
  }

  // ---------------------------------------------------------------------------
  // Hours helpers
  // ---------------------------------------------------------------------------

  function updateHourRow(weekday: number, patch: Partial<VenueHourRow>) {
    setHours((prev) =>
      prev.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)),
    );
  }

  function getHourRow(weekday: number): VenueHourRow {
    return (
      hours.find((r) => r.weekday === weekday) ?? {
        weekday,
        open: false,
        open_time: null,
        close_time: null,
      }
    );
  }

  async function handleSaveHours() {
    setHoursSaving(true);
    const result = await saveVenueHours(hours);
    setHoursSaving(false);
    if (!result.ok) {
      toast.error(result.error);
    } else {
      toast.success("Opening hours saved.");
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Venue profile                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Venue profile
        </h2>

        <form onSubmit={handleSubmit(onSubmitProfile)} noValidate className="space-y-5">
          {serverError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          {/* Venue name */}
          <div className="space-y-1.5">
            <Label htmlFor="venue-name">Venue name</Label>
            <Input
              id="venue-name"
              type="text"
              autoComplete="organization"
              placeholder="The Grand Hall"
              aria-invalid={!!errors.name}
              disabled={!canManage}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="venue-slug">Web address</Label>
            <Input
              id="venue-slug"
              type="text"
              autoComplete="off"
              placeholder="the-grand-hall"
              aria-invalid={!!errors.slug}
              disabled={!canManage}
              {...register("slug", {
                onChange: () => setSlugManuallyEdited(true),
              })}
            />
            {errors.slug ? (
              <p className="text-xs text-destructive">{errors.slug.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Public enquiry form:{" "}
                <span className="font-medium text-foreground">
                  venueflow.io/f/{watchedSlug || "your-venue"}
                </span>
              </p>
            )}
          </div>

          {/* Timezone */}
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <TimezoneCombobox
              value={watchedTimezone}
              onChange={(v) => setValue("timezone", v, { shouldValidate: true })}
              disabled={!canManage || isSubmitting}
            />
            {errors.timezone && (
              <p className="text-xs text-destructive">{errors.timezone.message}</p>
            )}
          </div>

          {/* Logo */}
          <div className="space-y-1.5">
            <Label>Logo</Label>
            <div className="flex items-start gap-4">
              {/* Preview / monogram */}
              <div className="relative shrink-0">
                {displayLogo ? (
                  <>
                    <img
                      src={displayLogo}
                      alt="Venue logo"
                      className="size-12 rounded-lg object-contain border border-border bg-muted"
                    />
                    {canManage && (
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground pointer-coarse:size-11 pointer-coarse:-top-4 pointer-coarse:-right-4"
                        aria-label="Remove logo"
                      >
                        <X className="size-2.5" />
                      </button>
                    )}
                  </>
                ) : (
                  <VenueMonogram name={watchedName || "V"} size="md" />
                )}
              </div>

              {/* Dropzone — only shown if canManage */}
              {canManage && (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Upload logo"
                  className={cn(
                    "flex flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground transition-colors",
                    dragOver && "border-primary bg-muted",
                    "hover:border-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDropzoneDrop}
                >
                  <Upload className="mb-1.5 size-5 opacity-50" />
                  <span>Drop image here or click to browse</span>
                  <span className="mt-0.5 text-xs opacity-60">PNG, JPG or WebP, max 2 MB</span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoFile(file);
                }}
              />
            </div>
          </div>

          {canManage ? (
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isSubmitting} className="min-w-32">
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving...
                  </span>
                ) : (
                  "Save profile"
                )}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Only owners and admins can update the venue profile.
            </p>
          )}
        </form>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Opening hours                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Opening hours
        </h2>

        <div className="space-y-1">
          {DISPLAY_ORDER.map((weekday) => {
            const row = getHourRow(weekday);
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
                    updateHourRow(weekday, {
                      open: checked,
                      open_time: checked ? "09:00" : null,
                      close_time: checked ? "17:00" : null,
                    });
                  }}
                  disabled={!canManage || hoursSaving}
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
                      onChange={(e) => updateHourRow(weekday, { open_time: e.target.value })}
                      disabled={!canManage || hoursSaving}
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
                      onChange={(e) => updateHourRow(weekday, { close_time: e.target.value })}
                      disabled={!canManage || hoursSaving}
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

        {canManage ? (
          <div className="flex justify-end pt-4">
            <Button
              type="button"
              disabled={hoursSaving}
              onClick={handleSaveHours}
              className="min-w-32"
            >
              {hoursSaving ? (
                <span className="flex items-center gap-2">
                  <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </span>
              ) : (
                "Save hours"
              )}
            </Button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Only owners and admins can update opening hours.
          </p>
        )}
      </div>
    </div>
  );
}
