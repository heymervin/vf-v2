import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Generic pill badge. Pastel/navy palette per DESIGN.md. For pipeline-stage
 * chips use <StageBadge> (it owns the fixed stage colors); this is for
 * everything else — channel tags, statuses, counts.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-transparent bg-accent text-accent-foreground",
        primary: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-muted text-muted-foreground",
        outline: "border-border text-foreground",
        success: "border-transparent bg-fun-green text-foreground",
        warning: "border-transparent bg-warning text-warning-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        pink: "border-transparent bg-fun-pink text-fun-pink-foreground",
        teal: "border-transparent bg-fun-teal text-foreground",
        blue: "border-transparent bg-fun-blue text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
