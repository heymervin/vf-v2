"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { STAGES } from "@/lib/pipeline";
import type { PipelineStage } from "@/lib/pipeline";
import type { Contact } from "@/lib/mock";

interface ContactsFilterBarProps {
  contacts: Contact[];
  onFilter: (filtered: Contact[]) => void;
}

export function ContactsFilterBar({ contacts, onFilter }: ContactsFilterBarProps) {
  const [query, setQuery] = useState("");
  const [activeStage, setActiveStage] = useState<PipelineStage | "all">("all");

  function applyFilter(q: string, stage: PipelineStage | "all") {
    const lower = q.toLowerCase();
    const result = contacts.filter((c) => {
      const matchesQuery =
        !q ||
        c.coupleName.toLowerCase().includes(lower) ||
        c.email.toLowerCase().includes(lower) ||
        c.phone.includes(q);
      const matchesStage = stage === "all" || c.stage === stage;
      return matchesQuery && matchesStage;
    });
    onFilter(result);
  }

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    applyFilter(q, activeStage);
  }

  function handleClearQuery() {
    setQuery("");
    applyFilter("", activeStage);
  }

  function handleStageChange(stage: PipelineStage | "all") {
    setActiveStage(stage);
    applyFilter(query, stage);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search couples, email or phone…"
          value={query}
          onChange={handleQueryChange}
          className="pl-8 pr-8"
          aria-label="Search contacts"
        />
        {query && (
          <button
            type="button"
            onClick={handleClearQuery}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Stage filter chips */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filter by stage"
      >
        <button
          type="button"
          onClick={() => handleStageChange("all")}
          className={cn(
            "inline-flex min-h-[36px] items-center rounded-full px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            activeStage === "all"
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          All
        </button>
        {STAGES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => handleStageChange(s.value)}
            className={cn(
              "inline-flex min-h-[36px] items-center rounded-full px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              activeStage === s.value
                ? s.chip + " ring-2 ring-offset-1 ring-foreground/20"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
