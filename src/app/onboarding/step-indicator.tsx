"use client";

import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  current: 1 | 2 | 3;
}

const STEPS = [
  { n: 1 as const, label: "Venue" },
  { n: 2 as const, label: "Space" },
  { n: 3 as const, label: "Hours" },
];

export function StepIndicator({ current }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1" role="list" aria-label="Onboarding steps">
      {STEPS.map((step, idx) => {
        const isComplete = step.n < current;
        const isActive = step.n === current;

        return (
          <div key={step.n} className="flex items-center" role="listitem">
            {/* Segment */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "h-1.5 w-16 rounded-full transition-colors",
                  isComplete
                    ? "bg-fun-pink"
                    : isActive
                      ? "bg-foreground"
                      : "bg-muted",
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "text-xs font-medium",
                  isActive
                    ? "text-foreground"
                    : isComplete
                      ? "text-fun-pink-strong"
                      : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Spacer between steps */}
            {idx < STEPS.length - 1 && (
              <div className="mx-1.5 h-px w-4 bg-border" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}
