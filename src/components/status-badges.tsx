import {
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  FileText,
  FileX2,
  HelpCircle,
  Mail,
  MinusCircle,
  Send,
  ThumbsDown,
  Timer,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { VariantProps } from "class-variance-authority"
import type { badgeVariants } from "@/components/ui/badge"

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"]

// ---------------------------------------------------------------------------
// ProposalStatusBadge
// ---------------------------------------------------------------------------

type ProposalStatus = "draft" | "sent" | "viewed" | "accepted" | "expired"

const PROPOSAL_MAP: Record<
  ProposalStatus,
  { variant: BadgeVariant; label: string; Icon: React.ElementType }
> = {
  draft:    { variant: "outline",     label: "Draft",    Icon: FileText },
  sent:     { variant: "warning",     label: "Sent",     Icon: Send },
  viewed:   { variant: "blue",        label: "Viewed",   Icon: Eye },
  accepted: { variant: "success",     label: "Accepted", Icon: CheckCircle2 },
  expired:  { variant: "destructive", label: "Expired",  Icon: Timer },
}

interface ProposalStatusBadgeProps {
  status: ProposalStatus
  className?: string
}

export function ProposalStatusBadge({ status, className }: ProposalStatusBadgeProps) {
  const { variant, label, Icon } = PROPOSAL_MAP[status] ?? PROPOSAL_MAP.draft
  return (
    <Badge variant={variant} className={className}>
      <Icon aria-hidden />
      {label}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// SupplierStatusBadge
// ---------------------------------------------------------------------------

type SupplierStatus = "confirmed" | "pending" | "enquired" | "declined"

const SUPPLIER_MAP: Record<
  SupplierStatus,
  { variant: BadgeVariant; label: string; Icon: React.ElementType }
> = {
  confirmed: { variant: "success",   label: "Confirmed", Icon: CheckCircle2 },
  pending:   { variant: "warning",   label: "Pending",   Icon: Clock },
  enquired:  { variant: "outline",   label: "Enquired",  Icon: Mail },
  declined:  { variant: "secondary", label: "Declined",  Icon: ThumbsDown },
}

interface SupplierStatusBadgeProps {
  status: SupplierStatus
  className?: string
}

export function SupplierStatusBadge({ status, className }: SupplierStatusBadgeProps) {
  const { variant, label, Icon } = SUPPLIER_MAP[status] ?? SUPPLIER_MAP.enquired
  return (
    <Badge variant={variant} className={className}>
      <Icon aria-hidden />
      {label}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// DocStatusBadge
// ---------------------------------------------------------------------------

type DocStatus = "signed" | "received" | "sent" | "draft" | "missing"

const DOC_MAP: Record<
  DocStatus,
  { variant: BadgeVariant; label: string; Icon: React.ElementType }
> = {
  signed:   { variant: "success",     label: "Signed",   Icon: FileCheck2 },
  received: { variant: "success",     label: "Received", Icon: FileCheck2 },
  sent:     { variant: "warning",     label: "Sent",     Icon: Send },
  draft:    { variant: "outline",     label: "Draft",    Icon: FileText },
  missing:  { variant: "destructive", label: "Missing",  Icon: FileX2 },
}

interface DocStatusBadgeProps {
  status: DocStatus
  className?: string
}

export function DocStatusBadge({ status, className }: DocStatusBadgeProps) {
  const { variant, label, Icon } = DOC_MAP[status] ?? DOC_MAP.missing
  return (
    <Badge variant={variant} className={className}>
      <Icon aria-hidden />
      {label}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// WeddingStatusBadge
// ---------------------------------------------------------------------------

type WeddingStatus = "planning" | "final_details" | "this_week" | "completed"

const WEDDING_MAP: Record<
  WeddingStatus,
  { variant: BadgeVariant; label: string; Icon: React.ElementType }
> = {
  planning:      { variant: "outline", label: "Planning",      Icon: HelpCircle },
  final_details: { variant: "warning", label: "Final details", Icon: Clock },
  this_week:     { variant: "pink",    label: "This week",     Icon: MinusCircle },
  completed:     { variant: "success", label: "Completed",     Icon: XCircle },
}

interface WeddingStatusBadgeProps {
  status: WeddingStatus
  className?: string
}

export function WeddingStatusBadge({ status, className }: WeddingStatusBadgeProps) {
  const { variant, label, Icon } = WEDDING_MAP[status] ?? WEDDING_MAP.planning
  return (
    <Badge variant={variant} className={className}>
      <Icon aria-hidden />
      {label}
    </Badge>
  )
}
