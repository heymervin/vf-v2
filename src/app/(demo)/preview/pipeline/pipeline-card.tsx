import Link from "next/link";
import { Calendar, Users, PoundSterling, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { teamMember, formatLongDate, gbp, TODAY, type Contact } from "@/lib/mock";
import { Badge } from "@/components/ui/badge";

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Score dot — color per DESIGN.md. Paired with aria-label (never color-only). */
function ScoreDot({ score }: { score: Contact["score"] }) {
  return (
    <span
      aria-label={`${score} lead`}
      title={`Lead score: ${score}`}
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        score === "hot" && "bg-fun-pink-strong",
        score === "warm" && "bg-warning",
        score === "cold" && "bg-muted-foreground/60",
      )}
    />
  );
}

/** Source chip — small muted pill. */
function SourceChip({ source }: { source: string }) {
  return (
    <span className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      {source}
    </span>
  );
}

/** Owner avatar — initials in a tiny circle. */
function OwnerChip({ ownerId }: { ownerId: string }) {
  const member = teamMember(ownerId);
  if (!member) return null;
  return (
    <span
      title={member.name}
      aria-label={`Owner: ${member.name}`}
      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground"
    >
      {member.initials}
    </span>
  );
}

/**
 * Last-contact recency label. Shows days since last message; highlights
 * contacts that haven't been touched in 7+ days.
 */
function RecencyChip({ lastMessageAt }: { lastMessageAt: string }) {
  const diff = new Date(TODAY).getTime() - new Date(lastMessageAt).getTime();
  const days = Math.floor(diff / 86_400_000);
  const label =
    days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days}d ago`;
  const urgent = days >= 7;

  return (
    <span
      title={`Last contact: ${label}`}
      aria-label={`Last contact ${label}`}
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] tabular-nums",
        urgent
          ? "font-semibold text-warning-foreground"
          : "text-muted-foreground/70",
      )}
    >
      <MessageCircle className="size-2.5 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

// ─── PipelineCard ─────────────────────────────────────────────────────────────

interface PipelineCardProps {
  contact: Contact;
}

export function PipelineCard({ contact: c }: PipelineCardProps) {
  return (
    <Link
      href={`/preview/contacts/${c.id}`}
      className={cn(
        "group block rounded-lg border border-border bg-card p-3 shadow-sm",
        "transition-all hover:-translate-y-0.5 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        // Ensure 44px minimum touch target height
        "min-h-[44px]",
      )}
    >
      {/* Row 1 — couple name + score dot */}
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-semibold leading-snug text-foreground">
          {c.coupleName}
        </p>
        <ScoreDot score={c.score} />
      </div>

      {/* Row 2 — wedding date + guest count */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {c.weddingDate ? (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Calendar className="size-3 shrink-0" aria-hidden />
            {formatLongDate(c.weddingDate)}
          </span>
        ) : (
          <span className="text-muted-foreground/50">No date set</span>
        )}
        {c.guestCount != null && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Users className="size-3 shrink-0" aria-hidden />
            {c.guestCount}
          </span>
        )}
      </div>

      {/* Row 3 — budget + last-contact recency (P1 additions) */}
      {(c.budget != null || c.lastMessageAt) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {c.budget != null && (
            <span className="inline-flex items-center gap-0.5 text-[10px] tabular-nums text-muted-foreground/70">
              <PoundSterling className="size-2.5 shrink-0" aria-hidden />
              {gbp(c.budget)}
            </span>
          )}
          {c.lastMessageAt && (
            <RecencyChip lastMessageAt={c.lastMessageAt} />
          )}
        </div>
      )}

      {/* Row 4 — source chip + unread badge + owner */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <SourceChip source={c.source} />
          {c.unread > 0 && (
            <Badge
              variant="pink"
              className="px-1.5 py-0 text-[10px] tabular-nums"
            >
              {c.unread}
            </Badge>
          )}
        </div>
        <OwnerChip ownerId={c.ownerId} />
      </div>
    </Link>
  );
}
