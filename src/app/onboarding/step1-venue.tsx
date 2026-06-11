"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { step1Schema, type Step1Input } from "@/lib/zod-schemas/onboarding";
import { createVenueWithProfile } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TimezoneCombobox } from "./timezone-combobox";
import { VenueMonogram } from "@/components/layout/venue-monogram";
import { AlertCircle, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step1Props {
  initialName?: string;
  initialSlug?: string;
  initialTimezone?: string;
  existingVenueId?: string;
  onComplete: (venueId: string) => void;
}

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export function Step1Venue({
  initialName = "",
  initialSlug = "",
  initialTimezone = "Europe/London",
  existingVenueId,
  onComplete,
}: Step1Props) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const [logoFile, setLogoFile] = React.useState<File | null>(null);
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
  } = useForm<Step1Input>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      name: initialName,
      slug: initialSlug || nameToSlug(initialName),
      timezone: initialTimezone,
    },
  });

  const watchedName = watch("name");
  const watchedSlug = watch("slug");
  const watchedTimezone = watch("timezone");

  // Auto-generate slug from name unless user manually edited it
  React.useEffect(() => {
    if (!slugManuallyEdited) {
      const generated = nameToSlug(watchedName);
      if (generated) setValue("slug", generated, { shouldValidate: false });
    }
  }, [watchedName, slugManuallyEdited, setValue]);

  function handleLogoFile(file: File) {
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
  }

  async function onSubmit(values: Step1Input) {
    setServerError(null);
    const fd = new FormData();
    fd.set("name", values.name);
    fd.set("slug", values.slug);
    fd.set("timezone", values.timezone);
    if (existingVenueId) fd.set("venueId", existingVenueId);
    if (logoFile) fd.set("logo", logoFile);

    const result = await createVenueWithProfile(fd);
    if (!result.ok) {
      if (result.error === "SLUG_TAKEN") {
        setServerError("That web address is taken, try another.");
      } else {
        setServerError(result.error);
      }
      return;
    }
    onComplete(result.data.venueId);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
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
          {...register("slug", {
            onChange: () => setSlugManuallyEdited(true),
          })}
        />
        {errors.slug ? (
          <p className="text-xs text-destructive">{errors.slug.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            This becomes your public enquiry form address:{" "}
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
          disabled={isSubmitting}
        />
        {errors.timezone && (
          <p className="text-xs text-destructive">{errors.timezone.message}</p>
        )}
      </div>

      {/* Logo upload (optional) */}
      <div className="space-y-1.5">
        <Label>Logo (optional)</Label>
        <div className="flex items-start gap-4">
          {/* Preview / monogram */}
          <div className="relative shrink-0">
            {logoPreview ? (
              <>
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="size-12 rounded-lg object-contain border border-border bg-muted"
                />
                <button
                  type="button"
                  onClick={removeLogo}
                  className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground pointer-coarse:size-11 pointer-coarse:-top-4 pointer-coarse:-right-4"
                  aria-label="Remove logo"
                >
                  <X className="size-2.5" />
                </button>
              </>
            ) : (
              <VenueMonogram name={watchedName || "V"} size="md" />
            )}
          </div>

          {/* Dropzone */}
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
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDropzoneDrop}
          >
            <Upload className="mb-1.5 size-5 opacity-50" />
            <span>Drop image here or click to browse</span>
            <span className="mt-0.5 text-xs opacity-60">PNG, JPG or WebP, max 2 MB</span>
          </div>

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

      {/* CTA */}
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting} className="min-w-32">
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating...
            </span>
          ) : (
            "Create my venue"
          )}
        </Button>
      </div>
    </form>
  );
}
