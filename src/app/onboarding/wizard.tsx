"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { StepIndicator } from "./step-indicator";
import { Step1Venue } from "./step1-venue";
import { Step2Space } from "./step2-space";
import { Step3Hours } from "./step3-hours";
import type { HourRow } from "@/lib/zod-schemas/onboarding";
import { Toaster } from "@/components/ui/sonner";

type Step = 1 | 2 | 3;

export interface WizardInitialState {
  step: Step;
  venueId?: string;
  venueName?: string;
  venueSlug?: string;
  venueTimezone?: string;
  existingHours?: HourRow[];
}

const BRAND_COPY: Record<Step, { heading: string; body: string }> = {
  1: {
    heading: "Let's get your venue set up.",
    body: "Two minutes, tops.",
  },
  2: {
    heading: "Tell us about your spaces.",
    body: "You can always add more from Settings.",
  },
  3: {
    heading: "Set your opening hours.",
    body: "This powers your availability calendar from day one.",
  },
};

interface WizardProps {
  initial: WizardInitialState;
}

export function OnboardingWizard({ initial }: WizardProps) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>(initial.step);
  const [venueId, setVenueId] = React.useState<string | undefined>(initial.venueId);
  const [celebrating, setCelebrating] = React.useState(false);
  // Lifted hours state — persists across back/forward navigation between steps 2 and 3
  const [hours, setHours] = React.useState<HourRow[] | undefined>(initial.existingHours);

  const copy = BRAND_COPY[step];

  function handleStep1Complete(newVenueId: string) {
    setVenueId(newVenueId);
    setStep(2);
  }

  function handleStep2Complete() {
    setStep(3);
  }

  function handleStep3Complete() {
    // On desktop: brief one-shot spring pulse on brand panel (≤550ms), then redirect.
    // On mobile: panel is hidden — redirect immediately (no dead wait).
    // prefers-reduced-motion: redirect immediately via the global animation kill.
    const isMobile = !window.matchMedia("(min-width: 768px)").matches;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = isMobile || prefersReduced ? 0 : 560;
    setCelebrating(true);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, delay);
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Toaster />
      {/* ------------------------------------------------------------------ */}
      {/* Left panel: brand / encouragement (~40%)                            */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={[
          "hidden md:flex md:w-[40%] shrink-0 flex-col justify-between p-10",
          "relative overflow-hidden",
          // 135deg wash: fun-pink → background → mint, full-chroma token stops
          // so the hue reads clearly (Committed register)
          "bg-[linear-gradient(135deg,var(--fun-pink)_0%,var(--background)_50%,var(--mint)_100%)]",
          // One-shot celebration spring pulse
          celebrating ? "animate-celebrate" : "",
        ].join(" ")}
        aria-label="Onboarding progress"
      >
        {/* Wordmark */}
        <div>
          <span className="text-sm font-semibold tracking-tight text-foreground select-none">
            VenueFlow
          </span>
        </div>

        {/* Per-step encouragement */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Step {step} of 3
          </p>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground">
            {copy.heading}
          </h1>
          <p className="text-base text-muted-foreground">{copy.body}</p>
        </div>

        {/* Subtle decorative blobs — pastel, aria-hidden */}
        <div
          className="pointer-events-none absolute -bottom-16 -right-16 size-56 rounded-full bg-[oklch(0.906_0.073_319/0.25)] blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -top-12 -left-12 size-40 rounded-full bg-[oklch(0.882_0.062_195/0.25)] blur-3xl"
          aria-hidden="true"
        />

        {/* Footer mark */}
        <div>
          <p className="text-xs text-muted-foreground">
            venueflow.io
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Right panel: restrained form surface                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-1 flex-col overflow-y-auto bg-background">
        {/* Mobile brand band */}
        <div
          className="flex items-center justify-between px-5 py-4 md:hidden bg-[linear-gradient(90deg,var(--fun-pink)_0%,var(--mint)_100%)]"
        >
          <span className="text-sm font-semibold tracking-tight text-foreground">
            VenueFlow
          </span>
          <span className="text-xs text-muted-foreground">Step {step} of 3</span>
        </div>

        {/* Form card */}
        <div className="flex flex-1 items-start justify-center px-5 py-8 md:items-center md:py-12">
          <div className="w-full max-w-md space-y-7">
            {/* Step indicator */}
            <StepIndicator current={step} />

            {/* Step heading (visible on mobile; desktop shows on left panel) */}
            <div className="md:hidden space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {copy.heading}
              </h1>
              <p className="text-sm text-muted-foreground">{copy.body}</p>
            </div>

            {/* Step content */}
            {step === 1 && (
              <Step1Venue
                initialName={initial.venueName}
                initialSlug={initial.venueSlug}
                initialTimezone={initial.venueTimezone ?? "Europe/London"}
                existingVenueId={venueId}
                onComplete={handleStep1Complete}
              />
            )}

            {step === 2 && venueId && (
              <Step2Space
                venueId={venueId}
                onComplete={handleStep2Complete}
                onBack={() => setStep(1)}
              />
            )}

            {step === 3 && venueId && (
              <Step3Hours
                venueId={venueId}
                initialRows={hours}
                onHoursChange={setHours}
                onComplete={handleStep3Complete}
                onBack={() => setStep(2)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
