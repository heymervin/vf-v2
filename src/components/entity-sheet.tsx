"use client"

import * as React from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EntitySheetProps {
  trigger: React.ReactNode
  title: string
  description?: string
  /** Form content rendered in the scrollable body */
  children: React.ReactNode
  onSave?: () => void
  saveLabel?: string
  side?: "right" | "bottom"
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EntitySheet({
  trigger,
  title,
  description,
  children,
  onSave,
  saveLabel = "Save",
  side = "right",
}: EntitySheetProps) {
  const [open, setOpen] = React.useState(false)

  function handleSave() {
    if (onSave) {
      onSave()
    } else {
      toast("Saved (prototype)")
    }
    setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* Trigger — wrap in a span so arbitrary ReactNode works with the Sheet */}
      <span
        onClick={() => setOpen(true)}
        className="inline-flex cursor-pointer"
        role="presentation"
      >
        {trigger}
      </span>

      <SheetContent
        side={side}
        className={cn(
          "flex flex-col gap-0 p-0",
          // Right sheet: standard responsive width
          side === "right" && "sm:max-w-md",
          // Bottom sheet: auto height, capped
          side === "bottom" && "h-auto max-h-[90dvh]"
        )}
      >
        {/* Header */}
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="text-base font-semibold text-foreground">
            {title}
          </SheetTitle>
          {description && (
            <SheetDescription className="text-sm text-muted-foreground">
              {description}
            </SheetDescription>
          )}
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {/* Footer */}
        <SheetFooter className="border-t border-border px-6 py-4 flex-row items-center justify-end gap-2">
          <SheetClose asChild>
            <Button variant="ghost" size="default">
              Cancel
            </Button>
          </SheetClose>
          <Button variant="default" size="default" onClick={handleSave}>
            {saveLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
