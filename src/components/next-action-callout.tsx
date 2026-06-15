import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface NextActionCalloutProps {
  severity: "info" | "warning" | "destructive" | "success"
  title: string
  detail?: string
  /** If provided, the action button links here */
  href?: string
  actionLabel?: string
  className?: string
}

// Severity → tinted bg + icon + text tokens.
// No side-stripe (banned). Calm, horizontal layout.
// Backgrounds use low-opacity overlays so tokens still read in dark mode.
const SEVERITY_MAP = {
  info: {
    bg: "bg-accent",
    iconColor: "text-accent-foreground",
    Icon: Info,
  },
  warning: {
    bg: "bg-warning/15",
    iconColor: "text-warning-foreground",
    Icon: AlertTriangle,
  },
  destructive: {
    bg: "bg-destructive/10",
    iconColor: "text-destructive",
    Icon: AlertCircle,
  },
  success: {
    bg: "bg-fun-green/40",
    iconColor: "text-fun-green-strong",
    Icon: CheckCircle2,
  },
} as const

/**
 * NextActionCallout — a calm, full-width horizontal callout panel.
 * Severity-tinted background, icon, title + optional detail, optional CTA.
 * No side-stripe. DESIGN.md-compliant.
 */
export function NextActionCallout({
  severity,
  title,
  detail,
  href,
  actionLabel,
  className,
}: NextActionCalloutProps) {
  const { bg, iconColor, Icon } = SEVERITY_MAP[severity]
  const hasAction = href && actionLabel

  return (
    <div
      role="region"
      aria-label={title}
      className={cn(
        "flex items-start gap-3 rounded-xl px-4 py-3",
        "min-h-[44px]",
        bg,
        className,
      )}
    >
      {/* Icon */}
      <Icon
        className={cn("size-4 mt-0.5 shrink-0", iconColor)}
        aria-hidden
      />

      {/* Body */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-snug">{title}</p>
        {detail && (
          <p className="mt-0.5 text-[13px] text-muted-foreground leading-snug">{detail}</p>
        )}
      </div>

      {/* CTA */}
      {hasAction && (
        <Button
          variant="outline"
          size="sm"
          asChild
          className="shrink-0 self-center min-h-[44px]"
        >
          <Link href={href}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  )
}
