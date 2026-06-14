"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STAGES } from "@/lib/pipeline";
import { ContactFormSheet } from "./contact-form-sheet";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name", label: "Name A–Z" },
  { value: "wedding_date", label: "Wedding date" },
] as const;

const ALL = "all";

export function ContactsToolbar({ sources }: { sources: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [query, setQuery] = React.useState(params.get("q") ?? "");

  // Build a new URL with one param changed (empty/ALL clears it).
  const setParam = React.useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (!value || value === ALL) next.delete(key);
      else next.set(key, value);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  // Debounce the free-text search.
  React.useEffect(() => {
    const current = params.get("q") ?? "";
    if (query === current) return;
    const t = setTimeout(() => setParam("q", query.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const stage = params.get("stage") ?? ALL;
  const source = params.get("source") ?? ALL;
  const sort = params.get("sort") ?? ALL;
  const hasFilters =
    !!params.get("q") ||
    !!params.get("stage") ||
    !!params.get("source") ||
    !!params.get("sort");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email"
          className="pl-9"
          aria-label="Search contacts"
        />
      </div>

      {/* Stage filter */}
      <Select value={stage} onValueChange={(v) => setParam("stage", v)}>
        <SelectTrigger className="w-[170px]" aria-label="Filter by stage">
          <SelectValue placeholder="All stages" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All stages</SelectItem>
          {STAGES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Source filter (only when sources exist) */}
      {sources.length > 0 && (
        <Select value={source} onValueChange={(v) => setParam("source", v)}>
          <SelectTrigger className="w-[150px]" aria-label="Filter by source">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All sources</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Sort */}
      <Select value={sort} onValueChange={(v) => setParam("sort", v)}>
        <SelectTrigger className="w-[150px]" aria-label="Sort contacts">
          <SelectValue placeholder="Newest" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Newest</SelectItem>
          {SORT_OPTIONS.slice(1).map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.replace(pathname, { scroll: false })}
        >
          <X /> Clear
        </Button>
      )}

      {/* New contact — pushed to the right */}
      <Button className="ml-auto" onClick={() => setCreateOpen(true)}>
        <Plus /> New contact
      </Button>

      <ContactFormSheet open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
