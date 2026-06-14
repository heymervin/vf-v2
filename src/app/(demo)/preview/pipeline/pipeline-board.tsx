"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { StageBadge } from "@/components/stage-badge";
import { PipelineCard } from "./pipeline-card";
import type { Contact } from "@/lib/mock";
import type { StageMeta } from "@/lib/pipeline";

interface ColumnData {
  stage: StageMeta;
  contacts: Contact[];
}

interface PipelineBoardProps {
  columnData: ColumnData[];
  totalCount: number;
}

/** Score dot legend item — mirrors ScoreDot in pipeline-card but inline here. */
function LegendDot({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn("inline-block size-2 rounded-full", color)} />
      {label}
    </span>
  );
}

export function PipelineBoard({ columnData, totalCount }: PipelineBoardProps) {
  const [query, setQuery] = React.useState("");

  const q = query.trim().toLowerCase();

  // Filter contacts in each column by coupleName search.
  const filtered = columnData.map((col) => ({
    ...col,
    contacts: q
      ? col.contacts.filter((c) => c.coupleName.toLowerCase().includes(q))
      : col.contacts,
  }));

  const visibleCount = filtered.reduce((sum, col) => sum + col.contacts.length, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="mx-auto mb-4 flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-3 px-0">
        {/* Search */}
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search couples…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 text-sm"
            aria-label="Search pipeline"
          />
        </div>

        {/* Right — count + legend */}
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground tabular-nums">
            {q ? `${visibleCount} of ${totalCount}` : `${totalCount} contacts`}
          </span>

          {/* Score legend */}
          <div className="hidden items-center gap-4 sm:flex">
            <LegendDot color="bg-fun-pink-strong" label="Hot" />
            <LegendDot color="bg-warning" label="Warm" />
            <LegendDot color="bg-muted-foreground" label="Cold" />
          </div>
        </div>
      </div>

      {/*
        Full-bleed horizontal scroll region. Negative horizontal margin breaks
        out of any parent padding so columns run to the viewport edge.
        pb-4 keeps the bottom shadow of the last card visible.
      */}
      <div className="-mx-4 flex-1 overflow-x-auto px-4 pb-6 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
        <div
          className="inline-flex min-w-full gap-3 align-top"
          role="list"
          aria-label="Pipeline stages"
        >
          {filtered.map(({ stage, contacts }) => (
            <section
              key={stage.value}
              role="listitem"
              aria-label={stage.label}
              className="flex w-[300px] shrink-0 flex-col"
            >
              {/* Column header */}
              <div className="mb-2 flex items-center justify-between px-0.5">
                <StageBadge stage={stage.value} />
                <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                  {contacts.length}
                </span>
              </div>

              {/* Column body */}
              <div
                className={cn(
                  "flex min-h-24 flex-1 flex-col gap-2 rounded-lg p-1.5",
                  "bg-muted/40",
                )}
              >
                {contacts.length > 0 ? (
                  contacts.map((c) => (
                    <PipelineCard key={c.id} contact={c} />
                  ))
                ) : (
                  <EmptyColumn stageName={stage.label} isFiltered={q.length > 0} />
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyColumn({
  stageName,
  isFiltered,
}: {
  stageName: string;
  isFiltered: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-3 py-8 text-center">
      <p className="text-xs font-medium text-muted-foreground">
        {isFiltered ? "No matches" : `No couples in ${stageName}`}
      </p>
      {!isFiltered && (
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          Cards move here as enquiries progress.
        </p>
      )}
    </div>
  );
}
