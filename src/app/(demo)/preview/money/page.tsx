import Link from "next/link";
import {
  TrendingUp,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Clock,
  Send,
  CreditCard,
  ChevronRight,
  FileText,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { cn } from "@/lib/utils";
import {
  WEDDINGS,
  getContact,
  gbp,
  formatLongDate,
  primaryWedding,
  proposalTotal,
  type MilestoneStatus,
  type PaymentMilestone,
} from "@/lib/mock";

export const metadata = { title: "Proposals & Payments" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** First payment with an active/upcoming status — the "next due" milestone. */
function nextMilestone(payments: PaymentMilestone[]): PaymentMilestone | null {
  return (
    payments.find((p) =>
      (["due", "upcoming", "overdue"] as MilestoneStatus[]).includes(p.status),
    ) ?? null
  );
}

/** Map contractStatus → Badge variant */
function contractBadgeVariant(
  status: string,
): "success" | "warning" | "outline" {
  if (status === "signed") return "success";
  if (status === "sent") return "warning";
  return "outline";
}

/** Map contractStatus → human label */
function contractLabel(status: string): string {
  if (status === "signed") return "Signed";
  if (status === "sent") return "Sent";
  return "Draft";
}

/** Map MilestoneStatus → Badge variant */
function milestoneBadgeVariant(
  status: MilestoneStatus,
): "success" | "warning" | "outline" | "destructive" {
  switch (status) {
    case "paid":
      return "success";
    case "due":
      return "warning";
    case "upcoming":
      return "outline";
    case "overdue":
      return "destructive";
  }
}

/** Human-readable milestone status label */
function milestoneLabel(status: MilestoneStatus): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "due":
      return "Due";
    case "upcoming":
      return "Upcoming";
    case "overdue":
      return "Overdue";
  }
}

// ---------------------------------------------------------------------------
// KPI computation
// ---------------------------------------------------------------------------

const totalBooked = WEDDINGS.reduce((sum, w) => sum + w.totalValue, 0);
const totalCollected = WEDDINGS.reduce((sum, w) => sum + w.paid, 0);
const totalOutstanding = totalBooked - totalCollected;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MoneyPage() {
  const primary = primaryWedding();
  const c2 = getContact("c2");

  const proposalTotal_ = proposalTotal(primary.proposal);
  const paidTotal = primary.payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const paymentGrandTotal = primary.payments.reduce(
    (s, p) => s + p.amount,
    0,
  );
  const paidPct = Math.round((paidTotal / paymentGrandTotal) * 100);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Proposals & Payments"
        subtitle="Track booked value, outstanding balances and every payment milestone — from proposal to final balance."
      />

      {/* ------------------------------------------------------------------ */}
      {/* Section 1 — KPI strip                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardContent className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-fun-blue text-fun-blue-strong">
              <TrendingUp className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Total booked value
              </p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {gbp(totalBooked)}
              </p>
              <p className="text-xs text-muted-foreground">
                {WEDDINGS.length} weddings
              </p>
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-fun-green text-fun-green-strong">
              <Wallet className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Collected
              </p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {gbp(totalCollected)}
              </p>
              <p className="text-xs text-muted-foreground">
                {Math.round((totalCollected / totalBooked) * 100)}% of booked
                value
              </p>
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning text-warning-foreground">
              <AlertCircle className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Outstanding
              </p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {gbp(totalOutstanding)}
              </p>
              <p className="text-xs text-muted-foreground">
                Across all upcoming milestones
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2 — Bookings / proposals table                             */}
      {/* ------------------------------------------------------------------ */}
      <Card className="mb-8">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-base font-semibold text-foreground">
            Bookings &amp; proposals
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Couple</TableHead>
                <TableHead>Contract</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="min-w-[140px]">Paid</TableHead>
                <TableHead>Next milestone</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Booked weddings */}
              {WEDDINGS.map((w) => {
                const next = nextMilestone(w.payments);
                const pct = Math.round((w.paid / w.totalValue) * 100);
                const contact = getContact(w.contactId);

                return (
                  <TableRow key={w.id} className="group min-h-[44px]">
                    <TableCell>
                      <Link
                        href={`/preview/weddings/${w.id}`}
                        className="flex items-center gap-2.5 min-h-[44px]"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fun-pink text-[11px] font-semibold text-fun-pink-foreground">
                          {contact?.initials ?? "??"}
                        </span>
                        <div>
                          <p className="font-medium text-foreground transition-colors group-hover:text-primary">
                            {w.coupleName}
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {formatLongDate(w.date)}
                          </p>
                        </div>
                      </Link>
                    </TableCell>

                    <TableCell>
                      <Badge variant={contractBadgeVariant(w.contractStatus)}>
                        {w.contractStatus === "signed" && (
                          <CheckCircle2 className="size-3" />
                        )}
                        {contractLabel(w.contractStatus)}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right font-medium tabular-nums text-foreground">
                      {gbp(w.totalValue)}
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {gbp(w.paid)}
                          </span>
                          <span className="text-xs font-medium tabular-nums text-foreground">
                            {pct}%
                          </span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    </TableCell>

                    <TableCell>
                      {next ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm text-foreground">
                            {next.label}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Clock className="size-3 text-muted-foreground" />
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {formatLongDate(next.dueDate)}
                            </span>
                            <Badge variant={milestoneBadgeVariant(next.status)}>
                              {milestoneLabel(next.status)}
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          All paid
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      <Link href={`/preview/weddings/${w.id}`}>
                        <ChevronRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* Open proposal — Khan & Reid (c2, date_on_hold) */}
              {c2 && (
                <TableRow className="group min-h-[44px] bg-warning/10">
                  <TableCell>
                    <Link
                      href={`/preview/contacts/${c2.id}`}
                      className="flex items-center gap-2.5 min-h-[44px]"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warning text-warning-foreground text-[11px] font-semibold">
                        {c2.initials}
                      </span>
                      <div>
                        <p className="font-medium text-foreground transition-colors group-hover:text-primary">
                          {c2.coupleName}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {c2.weddingDate ? formatLongDate(c2.weddingDate) : "Date TBC"}
                        </p>
                      </div>
                    </Link>
                  </TableCell>

                  <TableCell>
                    <Badge variant="warning">
                      <FileText className="size-3" />
                      Proposal sent
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right font-medium tabular-nums text-foreground">
                    {c2.budget ? gbp(c2.budget) : "—"}
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          £0
                        </span>
                        <span className="text-xs font-medium tabular-nums text-muted-foreground">
                          0%
                        </span>
                      </div>
                      <Progress value={0} className="h-1.5" />
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="text-sm text-warning-foreground font-medium">
                      Proposal sent — awaiting decision
                    </span>
                  </TableCell>

                  <TableCell>
                    <Link href={`/preview/contacts/${c2.id}`}>
                      <ChevronRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3 — Featured payment schedule (primary wedding)            */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Payment schedule
        </h2>
        <span className="text-sm text-muted-foreground">
          {primary.coupleName} · {primary.space} ·{" "}
          {formatLongDate(primary.date)}
        </span>
        <Link
          href={`/preview/weddings/${primary.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Open workspace
          <ChevronRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Proposal lines table */}
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-sm font-semibold text-foreground">
              Proposal breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {primary.proposal.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="max-w-[220px] whitespace-normal leading-snug text-foreground">
                      {line.label}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {line.qty}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {gbp(line.unit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-foreground">
                      {gbp(line.qty * line.unit)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="px-3 py-3 text-sm font-semibold text-foreground"
                  >
                    Total
                  </TableCell>
                  <TableCell className="px-3 py-3 text-right text-sm font-bold tabular-nums text-foreground">
                    {gbp(proposalTotal_)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>

        {/* Payment milestone timeline */}
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-start justify-between gap-4">
              <CardTitle className="text-sm font-semibold text-foreground">
                Payment milestones
              </CardTitle>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm">
                  <Send className="size-3.5" />
                  Send reminder
                </Button>
                <Button variant="default" size="sm">
                  <CreditCard className="size-3.5" />
                  Record payment
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {/* Overall progress bar */}
            <div className="mb-6">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Collected
                </span>
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {gbp(paidTotal)}{" "}
                  <span className="font-normal text-muted-foreground">
                    of {gbp(paymentGrandTotal)}
                  </span>
                </span>
              </div>
              <Progress value={paidPct} />
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                {paidPct}% received
              </p>
            </div>

            {/* Vertical timeline */}
            <ol className="relative space-y-0">
              {primary.payments.map((pm, idx) => {
                const isLast = idx === primary.payments.length - 1;
                const isPaid = pm.status === "paid";

                return (
                  <li key={pm.id} className="relative flex gap-4 pb-6 last:pb-0">
                    {/* Connector line */}
                    {!isLast && (
                      <span
                        className="absolute left-[13px] top-7 h-[calc(100%-4px)] w-px bg-border"
                        aria-hidden="true"
                      />
                    )}

                    {/* Node */}
                    <span
                      className={cn(
                        "relative mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                        isPaid
                          ? "border-fun-green-strong bg-fun-green text-fun-green-strong"
                          : pm.status === "due"
                            ? "border-warning-foreground bg-warning text-warning-foreground"
                            : pm.status === "overdue"
                              ? "border-destructive bg-destructive/10 text-destructive"
                              : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {isPaid ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : (
                        <span className="tabular-nums">{idx + 1}</span>
                      )}
                    </span>

                    {/* Content */}
                    <div className="flex flex-1 flex-wrap items-start justify-between gap-x-4 gap-y-1 pt-0.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {pm.label}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3 shrink-0" />
                          <span className="tabular-nums">
                            {formatLongDate(pm.dueDate)}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 self-start">
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {gbp(pm.amount)}
                        </span>
                        <Badge variant={milestoneBadgeVariant(pm.status)}>
                          {milestoneLabel(pm.status)}
                        </Badge>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

