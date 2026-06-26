"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { importGhlContactsAction } from "./actions";

const ALL = "all";

export function ContactsToolbar({
  sources,
  ghlConnected,
}: {
  sources: string[];
  ghlConnected: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [query, setQuery] = React.useState(params.get("q") ?? "");
  const [syncing, setSyncing] = React.useState(false);

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

  React.useEffect(() => {
    const current = params.get("q") ?? "";
    if (query === current) return;
    const t = setTimeout(() => setParam("q", query.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const source = params.get("source") ?? ALL;
  const hasFilters = !!params.get("q") || !!params.get("source");

  async function handleSync() {
    setSyncing(true);
    const result = await importGhlContactsAction();
    setSyncing(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const n = result.data.imported;
    toast.success(
      n > 0
        ? `Imported ${n} contact${n === 1 ? "" : "s"} from VenueFlow.`
        : "Already up to date.",
    );
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email"
          className="pl-9"
          aria-label="Search contacts"
        />
      </div>

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

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.replace(pathname, { scroll: false })}
        >
          <X /> Clear
        </Button>
      )}

      {ghlConnected && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="ml-auto"
        >
          <RefreshCw className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing…" : "Sync from VenueFlow"}
        </Button>
      )}
    </div>
  );
}
