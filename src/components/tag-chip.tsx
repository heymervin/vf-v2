import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface TagVariantTokens {
  bg: string
  icon: string
  text: string
}

/**
 * Tag vocabulary → pastel color mapping per DESIGN.md.
 * Text is always foreground (deep navy) — pastels are light surfaces.
 * `-strong` variants are used for the optional remove icon only.
 */
export const TAG_VARIANTS: Record<string, TagVariantTokens> = {
  "VIP":           { bg: "bg-fun-pink",  icon: "text-fun-pink-strong",    text: "text-foreground" },
  "Family":        { bg: "bg-fun-teal",  icon: "text-fun-teal-strong",    text: "text-foreground" },
  "Wedding party": { bg: "bg-fun-blue",  icon: "text-fun-blue-strong",    text: "text-foreground" },
  "Kids":          { bg: "bg-mint",      icon: "text-fun-teal-strong",    text: "text-foreground" },
  "Supplier":      { bg: "bg-muted",     icon: "text-muted-foreground",   text: "text-muted-foreground" },
  "Evening":       { bg: "bg-warning",   icon: "text-warning-foreground", text: "text-warning-foreground" },
  "preferred":     { bg: "bg-fun-green", icon: "text-fun-green-strong",   text: "text-foreground" },
}

/**
 * Returns the variant tokens for a tag string.
 * Falls back to `accent` for unknown tags.
 */
export function tagVariant(tag: string): TagVariantTokens {
  return TAG_VARIANTS[tag] ?? {
    bg: "bg-accent",
    icon: "text-accent-foreground",
    text: "text-accent-foreground",
  }
}

interface TagChipProps {
  tag: string
  /** When provided, renders an X button for filter-chip removal. */
  onRemove?: () => void
  className?: string
}

/**
 * Pastel tag chip — rounded-full, small, DESIGN.md-compliant.
 * Uses tagVariant() so color is always consistent across the app.
 * onRemove shows an X for use as a filter chip.
 */
export function TagChip({ tag, onRemove, className }: TagChipProps) {
  const v = tagVariant(tag)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
        "text-[11px] font-medium whitespace-nowrap",
        v.bg,
        v.text,
        className,
      )}
    >
      {tag}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${tag}`}
          className={cn(
            // 44px touch target — achieved via negative margin + padding trick
            // so the chip visual stays compact
            "-my-5 -mr-1 min-h-[44px] min-w-[44px] flex items-center justify-center p-0.5",
            v.icon,
            "hover:opacity-70 transition-opacity",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full",
          )}
        >
          <X className="size-3 shrink-0" aria-hidden />
        </button>
      )}
    </span>
  )
}
