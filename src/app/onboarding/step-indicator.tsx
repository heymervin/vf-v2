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
    <div
      className="flex items-center gap-1"
      role="list"
      aria-label="Onboarding steps"
    >
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
                  // Pink stays in the bar; labels use foreground tokens (Finding 10)
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
                  // AA-compliant: completed + active use --foreground; upcoming use --muted-foreground
                  isActive || isComplete
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
                // Finding 9: aria-current on the active step; sr-only state context
                aria-current={isActive ? "step" : undefined}
              >
                {step.label}
                {isComplete && (
                  <span className="sr-only"> (completed)</span>
                )}
                {isActive && (
                  <span className="sr-only"> (current step)</span>
                )}
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
