"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight, FileText, Wrench } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SmartListBar } from "@/components/smart-list-bar"
import { DataToolbar } from "@/components/data-toolbar"
import { ProposalStatusBadge } from "@/components/status-badges"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { gbp, formatLongDate, type Contact } from "@/lib/mock"
import type { Proposal } from "@/lib/mock"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProposalsSectionProps {
  proposals: Proposal[]
  contacts: Contact[]
}

// ---------------------------------------------------------------------------
// Smart list definitions
// ---------------------------------------------------------------------------

const STATUS_GROUPS: {
  id: string
  name: string
  statuses: Proposal["status"][]
}[] = [
  { id: "all", name: "All", statuses: ["draft", "sent", "viewed", "accepted", "expired"] },
  { id: "active", name: "Active", statuses: ["sent", "viewed"] },
  { id: "draft", name: "Drafts", statuses: ["draft"] },
  { id: "accepted", name: "Accepted", statuses: ["accepted"] },
  { id: "expired", name: "Expired", statuses: ["expired"] },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProposalsSection({ proposals, contacts }: ProposalsSectionProps) {
  const [activeList, setActiveList] = React.useState("all")
  const [search, setSearch] = React.useState("")
  const [sort, setSort] = React.useState("updated")

  // Derive counts for SmartListBar badges.
  const lists = STATUS_GROUPS.map((g) => ({
    id: g.id,
    name: g.name,
    count: proposals.filter((p) => g.statuses.includes(p.status)).length,
  }))

  // Helper: find contact for a proposal.
  const contactFor = (p: Proposal) =>
    contacts.find((c) => c.id === p.contactId)

  // Filter by active list.
  const group = STATUS_GROUPS.find((g) => g.id === activeList) ?? STATUS_GROUPS[0]
  let filtered = proposals.filter((p) => group.statuses.includes(p.status))

  // Filter by search (couple name).
  if (search.trim()) {
    const q = search.toLowerCase()
    filtered = filtered.filter((p) => {
      const c = contactFor(p)
      return c?.coupleName.toLowerCase().includes(q) ?? false
    })
  }

  // Sort.
  filtered = [...filtered].sort((a, b) => {
    if (sort === "value") return b.total - a.total
    if (sort === "couple") {
      const ca = contactFor(a)?.coupleName ?? ""
      const cb = contactFor(b)?.coupleName ?? ""
      return ca.localeCompare(cb)
    }
    // Default: "updated" — accepted first, then viewed, sent, draft, expired.
    const order: Proposal["status"][] = ["accepted", "viewed", "sent", "draft", "expired"]
    return order.indexOf(a.status) - order.indexOf(b.status)
  })

  const sortOptions = [
    { value: "updated", label: "By status" },
    { value: "value", label: "By value" },
    { value: "couple", label: "By couple" },
  ]

  return (
    <Card className="mb-8">
      <CardHeader className="border-b border-border pb-0">
        <div className="flex items-center justify-between gap-4 pb-3">
          <CardTitle className="text-base font-semibold text-foreground">
            Proposals
          </CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/preview/money/proposals/prop3/build">
              <Wrench className="size-3.5" />
              Open builder
            </Link>
          </Button>
        </div>

        {/* SmartListBar — status tabs */}
        <SmartListBar
          lists={lists}
          activeId={activeList}
          onChange={setActiveList}
        />
      </CardHeader>

      <CardContent className="p-0">
        {/* DataToolbar */}
        <div className="border-b border-border px-4 py-2">
          <DataToolbar
            search={{ value: search, onChange: setSearch, placeholder: "Search couples…" }}
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
              {search ? "Try a different search." : "Create a proposal using the builder."}
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
                const contact = contactFor(proposal)
                const depositAmt = Math.round((proposal.total * proposal.depositPct) / 100)
                const buildHref = `/preview/money/proposals/${proposal.id}/build`

                return (
                  <TableRow
                    key={proposal.id}
                    className="group min-h-[44px] cursor-pointer"
                    onClick={() => {
                      // Optimistic navigation — handled by the Link in the row.
                    }}
                  >
                    {/* Couple */}
                    <TableCell>
                      <Link
                        href={buildHref}
                        className="flex items-center gap-2.5 min-h-[44px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fun-pink text-[11px] font-semibold text-fun-pink-foreground">
                          {contact?.initials ?? "??"}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground transition-colors group-hover:text-primary truncate">
                            {contact?.coupleName ?? "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {proposal.id}
                          </p>
                        </div>
                      </Link>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <ProposalStatusBadge status={proposal.status} />
                    </TableCell>

                    {/* Wedding date */}
                    <TableCell className="hidden sm:table-cell text-sm tabular-nums text-muted-foreground">
                      {contact?.weddingDate
                        ? formatLongDate(contact.weddingDate)
                        : "—"}
                    </TableCell>

                    {/* Value */}
                    <TableCell className="text-right font-medium tabular-nums text-foreground">
                      {gbp(proposal.total)}
                    </TableCell>

                    {/* Deposit */}
                    <TableCell className="hidden md:table-cell text-right tabular-nums text-muted-foreground text-sm">
                      {gbp(depositAmt)}{" "}
                      <span className="text-xs">({proposal.depositPct}%)</span>
                    </TableCell>

                    {/* Chevron + build link */}
                    <TableCell>
                      <Link
                        href={buildHref}
                        aria-label={`Open proposal builder for ${contact?.coupleName}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center justify-center min-h-[44px] min-w-[44px]"
                      >
                        <ChevronRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
