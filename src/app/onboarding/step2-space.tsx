"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { step2Schema, type Step2Input } from "@/lib/zod-schemas/onboarding";
import { saveSpace } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle } from "lucide-react";

interface Step2Props {
  venueId: string;
  initialName?: string;
  onComplete: () => void;
  onBack: () => void;
}

export function Step2Space({ venueId, initialName = "", onComplete, onBack }: Step2Props) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isSkipping, setIsSkipping] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Step2Input>({
    resolver: zodResolver(step2Schema),
    defaultValues: { name: initialName },
  });

  const isBusy = isSubmitting || isSkipping;

  async function onSubmit(values: Step2Input) {
    setServerError(null);
    const fd = new FormData();
    fd.set("name", values.name);
    if (values.capacity_seated != null)
      fd.set("capacity_seated", String(values.capacity_seated));
    if (values.capacity_standing != null)
      fd.set("capacity_standing", String(values.capacity_standing));
    if (values.description) fd.set("description", values.description);

    const result = await saveSpace(venueId, fd);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    onComplete();
  }

  async function handleSkip() {
    setIsSkipping(true);
    setServerError(null);
    const result = await saveSpace(venueId, "skip");
    setIsSkipping(false);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    onComplete();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {serverError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {/* Space name */}
      <div className="space-y-1.5">
        <Label htmlFor="space-name">Space name</Label>
        <Input
          id="space-name"
          type="text"
          placeholder="The Main Hall"
          aria-invalid={!!errors.name}
          disabled={isBusy}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Capacities */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="capacity-seated">Seated capacity</Label>
          <Input
            id="capacity-seated"
            type="number"
            min="0"
            placeholder="120"
            disabled={isBusy}
            {...register("capacity_seated", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="capacity-standing">Standing capacity</Label>
          <Input
            id="capacity-standing"
            type="number"
            min="0"
            placeholder="200"
            disabled={isBusy}
            {...register("capacity_standing", { valueAsNumber: true })}
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="space-desc">Description (optional)</Label>
        <Textarea
          id="space-desc"
          placeholder="A light-filled converted barn with original oak beams..."
          rows={3}
          disabled={isBusy}
          {...register("description")}
        />
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description.message}</p>
        )}
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
            onClick={handleSkip}
            className="text-muted-foreground"
          >
            {isSkipping ? "Skipping..." : "Skip for now, you can add this in Settings."}
          </Button>

          <Button type="submit" disabled={isBusy} className="min-w-24">
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </span>
            ) : (
              "Continue"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
