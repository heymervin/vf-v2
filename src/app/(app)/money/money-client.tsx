"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronRight,
  Clock,
  FileText,
  TrendingUp,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Wrench,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SmartListBar } from "@/components/smart-list-bar";
import { DataToolbar } from "@/components/data-toolbar";
import { ProposalStatusBadge } from "@/components/status-badges";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatMinor } from "@/lib/money/proposal";
import { createProposal } from "./actions";
import type {
  MoneyKpis,
  ProposalWithWedding,
  WeddingPaymentHealth,
} from "./actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MoneyClientProps {
  kpis: MoneyKpis;
  proposals: ProposalWithWedding[];
  bookings: WeddingPaymentHealth[];
  weddings: { id: string; couple_names: string }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Date TBC";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function contractBadgeVariant(
  status: string,
): "success" | "warning" | "outline" {
  if (status === "signed") return "success";
  if (status === "sent") return "warning";
  return "outline";
}

function contractLabel(status: string): string {
  if (status === "signed") return "Signed";
  if (status === "sent") return "Sent";
  return "Draft";
}

function milestoneBadgeVariant(
  status: string,
): "success" | "warning" | "outline" | "destructive" {
  if (status === "paid") return "success";
  if (status === "due") return "warning";
  if (status === "overdue") return "destructive";
  return "outline";
}

function milestoneLabel(status: string): string {
  if (status === "paid") return "Paid";
  if (status === "due") return "Due";
  if (status === "overdue") return "Overdue";
  return "Upcoming";
}

// ---------------------------------------------------------------------------
// ProposalsSection
// ---------------------------------------------------------------------------

const STATUS_GROUPS: { id: string; name: string; statuses: string[] }[] = [
  { id: "all", name: "All", statuses: ["draft", "sent", "viewed", "accepted", "expired"] },
  { id: "active", name: "Active", statuses: ["sent", "viewed"] },
  { id: "draft", name: "Drafts", statuses: ["draft"] },
  { id: "accepted", name: "Accepted", statuses: ["accepted"] },
  { id: "expired", name: "Expired", statuses: ["expired"] },
];

function ProposalsSection({
  proposals,
  weddings,
}: {
  proposals: ProposalWithWedding[];
  weddings: { id: string; couple_names: string }[];
}) {
  const router = useRouter();
  const [activeList, setActiveList] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState("updated");
  const [creating, setCreating] = React.useState(false);

  const lists = STATUS_GROUPS.map((g) => ({
    id: g.id,
    name: g.name,
    count: proposals.filter((p) => g.statuses.includes(p.status)).length,
  }));

  const group = STATUS_GROUPS.find((g) => g.id === activeList) ?? STATUS_GROUPS[0]!;
  let filtered = proposals.filter((p) => group.statuses.includes(p.status));

  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter((p) =>
      (p.wedding?.couple_names ?? "").toLowerCase().includes(q),
    );
  }

  filtered = [...filtered].sort((a, b) => {
    if (sort === "value") return (b.total_minor ?? 0) - (a.total_minor ?? 0);
    if (sort === "couple") {
      const ca = a.wedding?.couple_names ?? "";
      const cb = b.wedding?.couple_names ?? "";
      return ca.localeCompare(cb);
    }
    const order = ["accepted", "viewed", "sent", "draft", "expired"];
    return order.indexOf(a.status) - order.indexOf(b.status);
  });

  const sortOptions = [
    { value: "updated", label: "By status" },
    { value: "value", label: "By value" },
    { value: "couple", label: "By couple" },
  ];

  async function handleNewProposal() {
    if (weddings.length === 0) {
      toast.error("Create a wedding first before adding a proposal.");
      return;
    }
    const firstWedding = weddings[0];
    if (!firstWedding) return;

    setCreating(true);
    const result = await createProposal({ weddingId: firstWedding.id });
    setCreating(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.push(`/money/proposals/${result.data.id}/build`);
  }

  return (
    <Card className="mb-8">
      <CardHeader className="border-b border-border pb-0">
        <div className="flex items-center justify-between gap-4 pb-3">
          <CardTitle className="text-base font-semibold text-foreground">
            Proposals
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewProposal}
            disabled={creating}
          >
            <Wrench className="size-3.5" />
            New proposal
          </Button>
        </div>
        <SmartListBar
          lists={lists}
          activeId={activeList}
          onChange={setActiveList}
        />
      </CardHeader>

      <CardContent className="p-0">
        <div className="border-b border-border px-4 py-2">
          <DataToolbar
            search={{
              value: search,
              onChange: setSearch,
              placeholder: "Search couples…",
            }}
            sort={{ value: sort, onChange: setSort, options: sortOptions }}
            resultCount={filtered.length}
            totalCount={proposals.length}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <FileText className="size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No proposals here</p>
            <p className="text-xs text-muted-foreground">
              {search
                ? "Try a different search."
                : "Create a proposal using the builder."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Couple</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Wedding date</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="hidden md:table-cell text-right">Deposit</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((proposal) => {
                const coupleName = proposal.wedding?.couple_names ?? "Unknown";
                const weddingDate = proposal.wedding?.wedding_date ?? null;
                const depositAmt = Math.round(
                  ((proposal.total_minor ?? 0) * proposal.deposit_pct) / 100,
                );
                const buildHref = `/money/proposals/${proposal.id}/build`;

                return (
                  <TableRow
                    key={proposal.id}
                    className="group min-h-[44px] cursor-pointer"
                  >
                    <TableCell>
                      <Link
                        href={buildHref}
                        className="flex items-center gap-2.5 min-h-[44px]"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fun-pink text-[11px] font-semibold text-fun-pink-foreground">
                          {coupleName.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground transition-colors group-hover:text-primary truncate">
                            {coupleName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {proposal.id.slice(0, 8)}…
                          </p>
                        </div>
                      </Link>
                    </TableCell>

                    <TableCell>
                      <ProposalStatusBadge
                        status={
                          proposal.status as
                            | "draft"
                            | "sent"
                            | "viewed"
                            | "accepted"
                            | "expired"
                        }
                      />
                    </TableCell>

                    <TableCell className="hidden sm:table-cell text-sm tabular-nums text-muted-foreground">
                      {formatDate(weddingDate)}
                    </TableCell>

                    <TableCell className="text-right font-medium tabular-nums text-foreground">
                      {formatMinor(proposal.total_minor ?? 0)}
                    </TableCell>

                    <TableCell className="hidden md:table-cell text-right tabular-nums text-muted-foreground text-sm">
                      {formatMinor(depositAmt)}{" "}
                      <span className="text-xs">({proposal.deposit_pct}%)</span>
                    </TableCell>

                    <TableCell>
                      <Link
                        href={buildHref}
                        aria-label={`Open proposal builder for ${coupleName}`}
                        className="flex items-center justify-center min-h-[44px] min-w-[44px]"
                      >
                        <ChevronRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// BookingsTable
// ---------------------------------------------------------------------------

function BookingsTable({ bookings }: { bookings: WeddingPaymentHealth[] }) {
  return (
    <Card className="mb-8">
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="text-base font-semibold text-foreground">
          Bookings &amp; payment health
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <FileText className="size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No bookings yet</p>
            <p className="text-xs text-muted-foreground">
              Booked weddings will appear here once created.
            </p>
          </div>
        ) : (
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
              {bookings.map((w) => {
                const totalMinor = w.total_value_minor ?? 0;
                const pct =
                  totalMinor > 0 ? Math.round((w.paid_minor / totalMinor) * 100) : 0;

                return (
                  <TableRow key={w.id} className="group min-h-[44px]">
                    <TableCell>
                      <Link
                        href={`/weddings/${w.id}`}
                        className="flex items-center gap-2.5 min-h-[44px]"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fun-pink text-[11px] font-semibold text-fun-pink-foreground">
                          {w.couple_names.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <p className="font-medium text-foreground transition-colors group-hover:text-primary">
                            {w.couple_names}
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {formatDate(w.wedding_date)}
                          </p>
                        </div>
                      </Link>
                    </TableCell>

                    <TableCell>
                      <Badge variant={contractBadgeVariant(w.contract_status)}>
                        {w.contract_status === "signed" && (
                          <CheckCircle2 className="size-3" />
                        )}
                        {contractLabel(w.contract_status)}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right font-medium tabular-nums text-foreground">
                      {formatMinor(totalMinor)}
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {formatMinor(w.paid_minor)}
                          </span>
                          <span className="text-xs font-medium tabular-nums text-foreground">
                            {pct}%
                          </span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    </TableCell>

                    <TableCell>
                      {w.next_milestone ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm text-foreground">
                            {w.next_milestone.label}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Clock className="size-3 text-muted-foreground" />
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {formatDate(w.next_milestone.due_date)}
                            </span>
                            <Badge
                              variant={milestoneBadgeVariant(w.next_milestone.status)}
                            >
                              {milestoneLabel(w.next_milestone.status)}
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
                      <Link href={`/weddings/${w.id}`}>
                        <ChevronRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// KPI strip
// ---------------------------------------------------------------------------

function KpiStrip({ kpis }: { kpis: MoneyKpis }) {
  const collectPct =
    kpis.totalBookedMinor > 0
      ? Math.round((kpis.totalCollectedMinor / kpis.totalBookedMinor) * 100)
      : 0;

  return (
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
              {formatMinor(kpis.totalBookedMinor)}
            </p>
            <p className="text-xs text-muted-foreground">
              {kpis.weddingCount} wedding{kpis.weddingCount !== 1 ? "s" : ""}
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
              {formatMinor(kpis.totalCollectedMinor)}
            </p>
            <p className="text-xs text-muted-foreground">
              {collectPct}% of booked value
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
              {formatMinor(kpis.totalOutstandingMinor)}
            </p>
            <p className="text-xs text-muted-foreground">
              Across all upcoming milestones
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MoneyClient (root)
// ---------------------------------------------------------------------------

export function MoneyClient({ kpis, proposals, bookings, weddings }: MoneyClientProps) {
  return (
    <>
      <KpiStrip kpis={kpis} />
      <ProposalsSection proposals={proposals} weddings={weddings} />
      <BookingsTable bookings={bookings} />
    </>
  );
}
