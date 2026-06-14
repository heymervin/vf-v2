import Link from "next/link";
import {
  Mail,
  MessageSquare,
  Phone,
  Calendar,
  Users,
  Banknote,
  ArrowRight,
  Heart,
  Flame,
  Thermometer,
  Snowflake,
  Inbox,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StageBadge } from "@/components/stage-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CONTACTS,
  WEDDINGS,
  getContact,
  getConversation,
  teamMember,
  gbp,
  daysFromToday,
  formatLongDate,
  formatMessageTime,
  type LeadScore,
  type Channel,
} from "@/lib/mock";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return CONTACTS.map((c) => ({ id: c.id }));
}

// ---- helpers ----------------------------------------------------------------

const CHANNEL_META: Record<Channel, { label: string; Icon: React.ElementType; chipClass: string }> = {
  email: { label: "Email", Icon: Mail, chipClass: "bg-fun-blue text-foreground" },
  sms: { label: "SMS", Icon: Phone, chipClass: "bg-fun-teal text-foreground" },
  whatsapp: { label: "WhatsApp", Icon: MessageSquare, chipClass: "bg-fun-green text-foreground" },
};

const SCORE_META: Record<LeadScore, { label: string; Icon: React.ElementType; chipClass: string }> = {
  hot: { label: "Hot", Icon: Flame, chipClass: "bg-destructive/15 text-destructive" },
  warm: { label: "Warm", Icon: Thermometer, chipClass: "bg-warning text-warning-foreground" },
  cold: { label: "Cold", Icon: Snowflake, chipClass: "bg-fun-blue text-foreground" },
};

// ---- page -------------------------------------------------------------------

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = getContact(id);

  if (!contact) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Users className="size-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Contact not found
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This contact doesn&apos;t exist in the prototype dataset.
          </p>
          <Link
            href="/preview/contacts"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Back to Contacts
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  const messages = getConversation(id);
  const owner = teamMember(contact.ownerId);
  const wedding = WEDDINGS.find((w) => w.contactId === id);
  const scoreMeta = SCORE_META[contact.score];
  const ScoreIcon = scoreMeta.Icon;

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* ---- header ---- */}
      <PageHeader
        title={contact.coupleName}
        shimmer={false}
        actions={
          <Link href="/preview/contacts">
            <Button variant="outline" size="sm">
              All Contacts
            </Button>
          </Link>
        }
      />

      {/* ---- meta chips row ---- */}
      <div className="mb-7 flex flex-wrap items-center gap-2">
        <StageBadge stage={contact.stage} />

        {/* Lead score */}
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
            scoreMeta.chipClass,
          )}
        >
          <ScoreIcon className="size-3" />
          {scoreMeta.label}
        </span>

        {/* Source */}
        <Badge variant="outline">{contact.source}</Badge>

        {/* Owner */}
        {owner && (
          <span className="text-xs text-muted-foreground">
            Owner:{" "}
            <span className="font-medium text-foreground">{owner.name}</span>
          </span>
        )}
      </div>

      {/* ---- two-column layout ---- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">

        {/* LEFT — activity timeline */}
        <section>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Conversation timeline
          </p>

          {messages.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
              <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Inbox className="size-5" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                No messages yet
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Send a reply via Email, SMS or WhatsApp and it will appear here
                in one unified thread.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <ul className="divide-y divide-border">
                {messages.map((msg) => {
                  const ch = CHANNEL_META[msg.channel];
                  const ChIcon = ch.Icon;
                  const isOut = msg.direction === "out";
                  return (
                    <li key={msg.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Channel chip */}
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            ch.chipClass,
                          )}
                        >
                          <ChIcon className="size-3" />
                          {ch.label}
                        </span>

                        {/* Direction */}
                        <span className="text-xs text-muted-foreground">
                          {isOut ? msg.author : contact.coupleName}
                        </span>

                        {/* Timestamp */}
                        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                          {formatMessageTime(msg.at)}
                        </span>
                      </div>

                      {/* Body */}
                      <p
                        className={cn(
                          "mt-2 text-sm leading-relaxed",
                          isOut ? "text-foreground" : "text-foreground font-medium",
                        )}
                      >
                        {msg.body}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        {/* RIGHT rail */}
        <aside className="flex flex-col gap-4">

          {/* Key facts */}
          <Card size="sm">
            <CardHeader>
              <CardTitle>Key facts</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2.5">
                {contact.weddingDate && (
                  <FactRow
                    icon={<Calendar className="size-3.5" />}
                    label="Wedding date"
                    value={
                      <span className="tabular-nums">
                        {formatLongDate(contact.weddingDate)}
                      </span>
                    }
                  />
                )}
                {contact.guestCount != null && (
                  <FactRow
                    icon={<Users className="size-3.5" />}
                    label="Guest count"
                    value={
                      <span className="tabular-nums">
                        {contact.guestCount} guests
                      </span>
                    }
                  />
                )}
                {contact.budget != null && (
                  <FactRow
                    icon={<Banknote className="size-3.5" />}
                    label="Budget"
                    value={
                      <span className="tabular-nums">{gbp(contact.budget)}</span>
                    }
                  />
                )}
                <FactRow
                  icon={<ArrowRight className="size-3.5" />}
                  label="Source"
                  value={contact.source}
                />
                <FactRow
                  icon={<Calendar className="size-3.5" />}
                  label="Enquired"
                  value={
                    <span className="tabular-nums">
                      {formatLongDate(contact.createdAt)}
                    </span>
                  }
                />
              </dl>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card size="sm">
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <Button variant="default" className="w-full justify-start gap-2">
                  <MessageSquare className="size-4" />
                  Message couple
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Calendar className="size-4" />
                  Book viewing
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Banknote className="size-4" />
                  Send proposal
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Wedding workspace card — only when a wedding exists */}
          {wedding && <WeddingWorkspaceCard wedding={wedding} />}
        </aside>
      </div>
    </div>
  );
}

// ---- sub-components ---------------------------------------------------------

function FactRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <dt className="w-24 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-right text-xs font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}

function WeddingWorkspaceCard({ wedding }: { wedding: { id: string; coupleName: string; date: string } }) {
  const days = daysFromToday(wedding.date);
  const isPast = days < 0;
  const countdownLabel = isPast
    ? `${Math.abs(days)} days ago`
    : days === 0
    ? "Today"
    : `${days} days away`;

  return (
    <Card
      size="sm"
      className="border-fun-green-strong/30 bg-fun-green/20"
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <Heart className="size-4 text-fun-green-strong" />
          <CardTitle className="text-sm">Wedding Workspace</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium text-foreground">
          {wedding.coupleName}
        </p>
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          {formatLongDate(wedding.date)}
        </p>
        <span
          className={cn(
            "mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums",
            isPast ? "bg-muted text-muted-foreground" : "bg-fun-green text-foreground",
          )}
        >
          {countdownLabel}
        </span>
        <div className="mt-4">
          <Link href={`/preview/weddings/${wedding.id}`}>
            <Button variant="outline" size="sm" className="w-full gap-1.5">
              Open Workspace
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
