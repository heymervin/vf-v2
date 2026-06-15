"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  CircleDashed,
  MessageSquare,
  Mail,
  Phone,
  Lock,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { CommsIdentity } from "@/lib/mock/admin"

// ---------------------------------------------------------------------------
// Verification status badge — WhatsApp-specific
// ---------------------------------------------------------------------------

type VerificationStatus = "verified" | "in_review" | "action_needed" | "not_started"

const VERIFICATION_MAP: Record<
  VerificationStatus,
  {
    label: string
    description: string
    variant: "success" | "warning" | "destructive" | "secondary"
    Icon: React.ElementType
  }
> = {
  verified: {
    label: "Verified",
    description: "Your WhatsApp Business account is verified and sending is active.",
    variant: "success",
    Icon: CheckCircle2,
  },
  in_review: {
    label: "In review",
    description: "Meta is reviewing your submission. This typically takes 1–5 business days.",
    variant: "warning",
    Icon: Clock,
  },
  action_needed: {
    label: "Action needed",
    description: "Your submission was flagged. Review the feedback in Meta Business Manager and resubmit.",
    variant: "destructive",
    Icon: AlertTriangle,
  },
  not_started: {
    label: "Not started",
    description: "Submit your WhatsApp Business profile to Meta for verification before sending.",
    variant: "secondary",
    Icon: CircleDashed,
  },
}

function VerificationStatusBadge({
  status,
  className,
}: {
  status: VerificationStatus
  className?: string
}) {
  const { label, variant, Icon } = VERIFICATION_MAP[status]
  return (
    <Badge variant={variant} className={className}>
      <Icon aria-hidden />
      {label}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// SMS status badge — simpler (verified / pending)
// ---------------------------------------------------------------------------

type SmsStatus = "verified" | "in_review" | "action_needed" | "not_started"

function SmsStatusBadge({ status }: { status: SmsStatus }) {
  const map = VERIFICATION_MAP[status]
  const { label, variant, Icon } = map
  return (
    <Badge variant={variant}>
      <Icon aria-hidden />
      {label}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Field row — label + description + input, consistent layout
// ---------------------------------------------------------------------------

function FieldRow({
  label,
  description,
  htmlFor,
  children,
  readOnly,
}: {
  label: string
  description?: string
  htmlFor?: string
  children: React.ReactNode
  readOnly?: boolean
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {label}
        </Label>
        {readOnly && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            <Lock aria-hidden className="size-2.5" />
            Read-only
          </span>
        )}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      )}
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper — eyebrow + title + icon + description card
// ---------------------------------------------------------------------------

function SectionCard({
  eyebrow,
  title,
  description,
  icon: Icon,
  children,
  footer,
}: {
  eyebrow: string
  title: string
  description: string
  icon: React.ElementType
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon aria-hidden className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {eyebrow}
            </p>
            <CardTitle className="mt-0.5 text-base font-semibold text-foreground">
              {title}
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-muted-foreground leading-relaxed">
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 pt-5">
        {children}
      </CardContent>

      {footer && (
        <div className="border-t border-border px-6 py-4">
          {footer}
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function MessagingClient({ identity }: { identity: CommsIdentity }) {
  // Local optimistic state mirrors the mock
  const [sms, setSms] = React.useState({
    senderName: identity.smsSenderName,
    status: identity.smsStatus,
  })

  const [wa, setWa] = React.useState({
    displayName: identity.whatsappDisplayName,
    about: identity.whatsappAbout,
    category: identity.whatsappCategory,
    status: identity.whatsappStatus,
  })

  const [email, setEmail] = React.useState({
    fromName: identity.emailFromName,
    replyTo: identity.emailReplyTo,
    signature: identity.emailSignature,
    sendingDomain: identity.sendingDomain,
  })

  // ── Save handlers ──────────────────────────────────────────────────────────

  function handleSaveSms() {
    toast.success("SMS identity saved", {
      description: `Sender name updated to "${sms.senderName}".`,
    })
  }

  function handleSaveEmail() {
    toast.success("Email identity saved", {
      description: `Sending as "${email.fromName}" · replies to ${email.replyTo}.`,
    })
  }

  function handleWhatsAppSubmit() {
    const isResubmit =
      wa.status === "action_needed" || wa.status === "in_review"
    toast.success(
      isResubmit ? "Resubmission sent to Meta" : "Submitted to Meta for verification",
      {
        description:
          "You'll be notified when the status changes. This typically takes 1–5 business days.",
      }
    )
    // Optimistic: flip to in_review
    setWa((prev) => ({ ...prev, status: "in_review" }))
  }

  function handleSaveWa() {
    toast.success("WhatsApp Business profile saved")
  }

  // ── WhatsApp CTA label ─────────────────────────────────────────────────────
  const waCtaLabel =
    wa.status === "not_started"
      ? "Submit for verification"
      : wa.status === "action_needed"
      ? "Resubmit to Meta"
      : wa.status === "in_review"
      ? "Resubmit to Meta"
      : null // verified — no CTA needed

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* Page header (content — no shell, no PageHeader component) */}
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Sales setup
        </p>
        <h2 className="text-xl font-semibold tracking-[-0.022em] text-foreground">
          Messaging (SMS / WhatsApp)
        </h2>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed max-w-[60ch]">
          Configure the sender identities VenueFlow uses when contacting couples.
          Content is set per-sequence — these settings control <em>who</em> messages appear to come from.
        </p>
      </div>

      {/* ── 1. SMS ──────────────────────────────────────────────────────────── */}
      <SectionCard
        eyebrow="Channel 1"
        title="SMS"
        description="The sender name shown on outbound text messages. Must be 3–11 alphanumeric characters with no spaces."
        icon={Phone}
        footer={
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              Changes apply to future messages only — in-flight sequences are not affected.
            </p>
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveSms}
              className="shrink-0"
            >
              Save SMS identity
            </Button>
          </div>
        }
      >
        {/* Status row */}
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
          <SmsStatusBadge status={sms.status} />
          <p className="text-sm text-muted-foreground">
            {VERIFICATION_MAP[sms.status].description}
          </p>
        </div>

        <Separator />

        {/* Sender name */}
        <FieldRow
          label="Sender name"
          htmlFor="sms-sender"
          description="Alphanumeric only · max 11 characters · no spaces."
        >
          <Input
            id="sms-sender"
            value={sms.senderName}
            maxLength={11}
            pattern="[A-Za-z0-9]+"
            onChange={(e) =>
              setSms((prev) => ({ ...prev, senderName: e.target.value }))
            }
            className="max-w-xs font-mono"
            aria-describedby="sms-sender-hint"
          />
          <p
            id="sms-sender-hint"
            className={cn(
              "text-xs tabular-nums",
              sms.senderName.length > 11
                ? "text-destructive"
                : "text-muted-foreground"
            )}
          >
            {sms.senderName.length} / 11 characters
          </p>
        </FieldRow>
      </SectionCard>

      {/* ── 2. WhatsApp Business ────────────────────────────────────────────── */}
      <SectionCard
        eyebrow="Channel 2"
        title="WhatsApp Business"
        description="Your WhatsApp Business profile is what couples see when they receive a message from the venue. Verification is managed through Meta Business Manager."
        icon={MessageSquare}
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <p className="text-xs text-muted-foreground">
                Verification is handled by Meta — VenueFlow submits your profile on your behalf.
              </p>
              <a
                href="https://business.facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
              >
                Open Meta Business Manager
                <ExternalLink aria-hidden className="size-3" />
              </a>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveWa}
              >
                Save profile
              </Button>
              {waCtaLabel && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleWhatsAppSubmit}
                >
                  {waCtaLabel}
                </Button>
              )}
            </div>
          </div>
        }
      >
        {/* Status */}
        <div
          className={cn(
            "rounded-lg border px-4 py-3",
            wa.status === "verified" && "border-transparent bg-fun-green/40",
            wa.status === "in_review" && "border-transparent bg-warning/30",
            wa.status === "action_needed" && "border-transparent bg-destructive/10",
            wa.status === "not_started" && "border-border bg-muted/50"
          )}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
            <VerificationStatusBadge status={wa.status} className="self-start" />
            <p className="text-sm text-foreground leading-relaxed">
              {VERIFICATION_MAP[wa.status].description}
            </p>
          </div>
          {wa.status === "action_needed" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Check your Meta Business Manager inbox for the specific feedback, update your profile below, then resubmit.
            </p>
          )}
        </div>

        <Separator />

        {/* Display name */}
        <FieldRow
          label="Display name"
          htmlFor="wa-name"
          description="This is the name shown to couples in WhatsApp. Must match your registered business name."
        >
          <Input
            id="wa-name"
            value={wa.displayName}
            onChange={(e) =>
              setWa((prev) => ({ ...prev, displayName: e.target.value }))
            }
            className="max-w-sm"
          />
        </FieldRow>

        {/* About */}
        <FieldRow
          label="About"
          htmlFor="wa-about"
          description="A short description shown on your WhatsApp Business profile (max 139 characters)."
        >
          <Textarea
            id="wa-about"
            value={wa.about}
            maxLength={139}
            rows={3}
            onChange={(e) =>
              setWa((prev) => ({ ...prev, about: e.target.value }))
            }
          />
          <p
            className={cn(
              "text-xs tabular-nums",
              wa.about.length > 130
                ? "text-warning-foreground"
                : "text-muted-foreground"
            )}
          >
            {wa.about.length} / 139 characters
          </p>
        </FieldRow>

        {/* Category */}
        <FieldRow
          label="Business category"
          htmlFor="wa-category"
          description="Choose the category that best describes your venue. Used by Meta for discovery."
        >
          <Input
            id="wa-category"
            value={wa.category}
            onChange={(e) =>
              setWa((prev) => ({ ...prev, category: e.target.value }))
            }
            className="max-w-sm"
          />
          <p className="text-xs text-muted-foreground">
            Examples: &ldquo;Event Planning Service&rdquo;, &ldquo;Wedding Venue&rdquo;, &ldquo;Hotel &amp; Lodging&rdquo;
          </p>
        </FieldRow>
      </SectionCard>

      {/* ── 3. Email identity ───────────────────────────────────────────────── */}
      <SectionCard
        eyebrow="Channel 3"
        title="Email"
        description="Controls the sender name, reply address and signature used on all outbound emails. Your sending domain is managed by VenueFlow and cannot be changed here."
        icon={Mail}
        footer={
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              The sending domain is authenticated by VenueFlow via SPF/DKIM. Contact support to change it.
            </p>
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveEmail}
              className="shrink-0"
            >
              Save email identity
            </Button>
          </div>
        }
      >
        {/* From name */}
        <FieldRow
          label="From name"
          htmlFor="email-from"
          description="The name couples see in their email inbox before they open a message."
        >
          <Input
            id="email-from"
            value={email.fromName}
            onChange={(e) =>
              setEmail((prev) => ({ ...prev, fromName: e.target.value }))
            }
            className="max-w-sm"
          />
        </FieldRow>

        <Separator />

        {/* Reply-to */}
        <FieldRow
          label="Reply-to address"
          htmlFor="email-reply"
          description="Replies from couples go here. Does not need to match your sending domain."
        >
          <Input
            id="email-reply"
            type="email"
            value={email.replyTo}
            onChange={(e) =>
              setEmail((prev) => ({ ...prev, replyTo: e.target.value }))
            }
            className="max-w-sm"
          />
        </FieldRow>

        <Separator />

        {/* Signature */}
        <FieldRow
          label="Email signature"
          htmlFor="email-sig"
          description="Appended automatically to outbound emails. Plain text only — no HTML."
        >
          <Textarea
            id="email-sig"
            value={email.signature}
            rows={4}
            onChange={(e) =>
              setEmail((prev) => ({ ...prev, signature: e.target.value }))
            }
            className="font-mono text-sm"
          />
        </FieldRow>

        <Separator />

        {/* Sending domain — read-only */}
        <FieldRow
          label="Sending domain"
          htmlFor="email-domain"
          description="Emails are sent from this domain. SPF, DKIM and DMARC are configured by VenueFlow. Contact support to update."
          readOnly
        >
          <div className="flex items-center gap-2">
            <Input
              id="email-domain"
              value={email.sendingDomain}
              readOnly
              disabled
              className="max-w-xs font-mono opacity-70"
              aria-label="Sending domain (read-only)"
            />
            <CheckCircle2
              aria-label="Authenticated"
              className="size-4 shrink-0 text-fun-green-strong"
            />
            <span className="text-xs text-muted-foreground">Authenticated</span>
          </div>
        </FieldRow>
      </SectionCard>
    </div>
  )
}
