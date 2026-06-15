"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Tag,
  ArrowRightLeft,
  ListPlus,
  Flame,
  Thermometer,
  Snowflake,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DataToolbar } from "@/components/data-toolbar";
import { SortableTable, type SortableColumn } from "@/components/sortable-table";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { SmartListBar } from "@/components/smart-list-bar";
import { TagChip } from "@/components/tag-chip";
import { StageBadge } from "@/components/stage-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type Contact,
  type LeadScore,
  SMART_LISTS,
  VENUE_TAGS,
  gbp,
  formatLongDate,
  formatMessageTime,
} from "@/lib/mock";
import { STAGES, type PipelineStage } from "@/lib/pipeline";

// ---------------------------------------------------------------------------
// Score meta
// ---------------------------------------------------------------------------

const SCORE_META: Record<LeadScore, { label: string; Icon: React.ElementType; className: string }> = {
  hot:  { label: "Hot",  Icon: Flame,       className: "bg-destructive/10 text-destructive" },
  warm: { label: "Warm", Icon: Thermometer, className: "bg-warning text-warning-foreground" },
  cold: { label: "Cold", Icon: Snowflake,   className: "bg-fun-blue text-foreground" },
};

// ---------------------------------------------------------------------------
// Filter chip sub-component
// ---------------------------------------------------------------------------

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        "min-h-[28px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        active
          ? "bg-foreground text-background"
          : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

interface ContactsListClientProps {
  contacts: Contact[];
}

export function ContactsListClient({ contacts }: ContactsListClientProps) {
  const router = useRouter();

  // ── View state ──────────────────────────────────────────────────────────
  const [activeListId, setActiveListId] = useState("sl1");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<PipelineStage | "">("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [scoreFilter, setScoreFilter] = useState<LeadScore | "">("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Unique sources and owners from data
  const sources = useMemo(
    () => [...new Set(contacts.map((c) => c.source))].sort(),
    [contacts],
  );
  const owners = useMemo(
    () => [...new Set(contacts.map((c) => c.ownerId))],
    [contacts],
  );

  // ── SmartList filtering ─────────────────────────────────────────────────
  const smartListDef = useMemo(
    () => SMART_LISTS.find((sl) => sl.id === activeListId)?.filter ?? {},
    [activeListId],
  );

  // ── Filtered rows ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const lower = query.toLowerCase();
    return contacts.filter((c) => {
      // Smart list filters
      if (smartListDef.stages?.length && !smartListDef.stages.includes(c.stage)) return false;
      if (smartListDef.scores?.length && !smartListDef.scores.includes(c.score)) return false;
      if (smartListDef.owners?.length && !smartListDef.owners.includes(c.ownerId)) return false;
      if (smartListDef.unreadOnly && !c.unread) return false;

      // Toolbar filters
      if (stageFilter && c.stage !== stageFilter) return false;
      if (sourceFilter && c.source !== sourceFilter) return false;
      if (ownerFilter && c.ownerId !== ownerFilter) return false;
      if (scoreFilter && c.score !== scoreFilter) return false;
      if (
        lower &&
        !c.coupleName.toLowerCase().includes(lower) &&
        !c.email.toLowerCase().includes(lower) &&
        !c.phone.includes(lower)
      )
        return false;

      return true;
    });
  }, [contacts, query, stageFilter, sourceFilter, ownerFilter, scoreFilter, smartListDef]);

  // ── SmartList tab counts (live against base contacts, ignore toolbar filters) ──
  const smartListsWithCounts = useMemo(() => {
    return SMART_LISTS.map((sl) => {
      const count = contacts.filter((c) => {
        if (sl.filter.stages?.length && !sl.filter.stages.includes(c.stage)) return false;
        if (sl.filter.scores?.length && !sl.filter.scores.includes(c.score)) return false;
        if (sl.filter.owners?.length && !sl.filter.owners.includes(c.ownerId)) return false;
        if (sl.filter.unreadOnly && !c.unread) return false;
        return true;
      }).length;
      return { ...sl, count };
    });
  }, [contacts]);

  // ── Bulk actions ─────────────────────────────────────────────────────────
  const handleClearSelection = useCallback(() => setSelectedIds(new Set()), []);

  function handleBulkTag(tag: string) {
    toast.success(`Tagged ${selectedIds.size} contact${selectedIds.size > 1 ? "s" : ""} as "${tag}"`);
    setSelectedIds(new Set());
  }

  function handleBulkStage(stage: string) {
    toast.success(`Moved ${selectedIds.size} contact${selectedIds.size > 1 ? "s" : ""} to "${stage}"`);
    setSelectedIds(new Set());
  }

  function handleBulkAddToSequence() {
    toast.success(`Added ${selectedIds.size} contact${selectedIds.size > 1 ? "s" : ""} to nurture sequence`);
    setSelectedIds(new Set());
  }

  function handleBulkExport() {
    toast.success(`Exported ${selectedIds.size} contact${selectedIds.size > 1 ? "s" : ""} as CSV`);
    setSelectedIds(new Set());
  }

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns: SortableColumn<Contact>[] = [
    {
      key: "coupleName",
      header: "Name",
      sortable: true,
      sortValue: (c) => c.coupleName,
      render: (c) => (
        <div className="min-w-0">
          <p className="font-medium text-foreground">{c.coupleName}</p>
          <p className="text-xs text-muted-foreground">{c.email}</p>
          {c.unread > 0 && (
            <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-fun-pink px-1.5 py-px text-[10px] font-semibold text-fun-pink-foreground tabular-nums">
              {c.unread} unread
            </span>
          )}
        </div>
      ),
    },
    {
      key: "stage",
      header: "Stage",
      sortable: true,
      sortValue: (c) => c.stage,
      render: (c) => <StageBadge stage={c.stage} />,
    },
    {
      key: "score",
      header: "Score",
      sortable: true,
      sortValue: (c) => c.score,
      render: (c) => {
        const meta = SCORE_META[c.score];
        const Icon = meta.Icon;
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              meta.className,
            )}
          >
            <Icon className="size-3" aria-hidden />
            {meta.label}
          </span>
        );
      },
    },
    {
      key: "weddingDate",
      header: "Wedding date",
      sortable: true,
      sortValue: (c) => c.weddingDate ?? "",
      render: (c) => (
        <span className="tabular-nums text-sm text-foreground">
          {c.weddingDate ? formatLongDate(c.weddingDate) : <span className="text-muted-foreground">—</span>}
        </span>
      ),
    },
    {
      key: "budget",
      header: "Budget",
      sortable: true,
      align: "right",
      sortValue: (c) => c.budget ?? 0,
      render: (c) => (
        <span className="tabular-nums text-sm text-foreground">
          {c.budget != null ? gbp(c.budget) : <span className="text-muted-foreground">—</span>}
        </span>
      ),
    },
    {
      key: "source",
      header: "Source",
      sortable: true,
      sortValue: (c) => c.source,
      render: (c) => (
        <Badge variant="outline" className="text-xs font-normal">
          {c.source}
        </Badge>
      ),
    },
    {
      key: "tags",
      header: "Tags",
      render: (c) => (
        <div className="flex flex-wrap gap-1">
          {(c.tags ?? []).slice(0, 2).map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
          {(c.tags ?? []).length > 2 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              +{(c.tags ?? []).length - 2}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "lastMessage",
      header: "Last message",
      sortable: true,
      sortValue: (c) => c.lastMessageAt,
      render: (c) => (
        <span className="tabular-nums text-xs text-muted-foreground">
          {formatMessageTime(c.lastMessageAt)}
        </span>
      ),
    },
  ];

  // ── Empty state ───────────────────────────────────────────────────────────
  const emptyState = (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Users className="size-6" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">
          {query || stageFilter || sourceFilter || scoreFilter
            ? "No contacts match these filters"
            : "No contacts in this view"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {query || stageFilter || sourceFilter || scoreFilter
            ? "Try adjusting your search or clearing the filters."
            : "Change the view or add contacts to get started."}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Smart list tabs */}
      <SmartListBar
        lists={smartListsWithCounts}
        activeId={activeListId}
        onChange={(id) => {
          setActiveListId(id);
          setSelectedIds(new Set());
        }}
      />

      {/* Toolbar */}
      <DataToolbar
        search={{
          value: query,
          onChange: setQuery,
          placeholder: "Search couples, email or phone…",
        }}
        resultCount={filtered.length}
        totalCount={contacts.length}
        actions={
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Download className="size-3.5" aria-hidden />
            Export
          </Button>
        }
      >
        {/* Stage filter chips */}
        <FilterChip
          label="All stages"
          active={!stageFilter}
          onClick={() => setStageFilter("")}
        />
        {STAGES.filter((s) => s.value !== "archived").map((s) => (
          <FilterChip
            key={s.value}
            label={s.label}
            active={stageFilter === s.value}
            onClick={() => setStageFilter(stageFilter === s.value ? "" : s.value)}
          />
        ))}

        {/* Score filter */}
        {(["hot", "warm", "cold"] as LeadScore[]).map((score) => (
          <FilterChip
            key={score}
            label={score.charAt(0).toUpperCase() + score.slice(1)}
            active={scoreFilter === score}
            onClick={() => setScoreFilter(scoreFilter === score ? "" : score)}
          />
        ))}

        {/* Source filter */}
        {sources.map((src) => (
          <FilterChip
            key={src}
            label={src}
            active={sourceFilter === src}
            onClick={() => setSourceFilter(sourceFilter === src ? "" : src)}
          />
        ))}
      </DataToolbar>

      {/* Bulk action bar */}
      <BulkActionBar count={selectedIds.size} onClear={handleClearSelection}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Tag className="size-3.5" aria-hidden />
              Tag
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {VENUE_TAGS.map((tag) => (
              <DropdownMenuItem key={tag} onClick={() => handleBulkTag(tag)}>
                {tag}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <ArrowRightLeft className="size-3.5" aria-hidden />
              Change stage
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {STAGES.map((s) => (
              <DropdownMenuItem key={s.value} onClick={() => handleBulkStage(s.label)}>
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={handleBulkAddToSequence}
        >
          <ListPlus className="size-3.5" aria-hidden />
          Add to sequence
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={handleBulkExport}
        >
          <Download className="size-3.5" aria-hidden />
          Export
        </Button>
      </BulkActionBar>

      {/* Table */}
      <SortableTable
        columns={columns}
        rows={filtered}
        getRowId={(c) => c.id}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onRowClick={(c) => router.push(`/preview/contacts/${c.id}`)}
        initialSort={{ key: "lastMessage", dir: "desc" }}
        emptyState={emptyState}
      />
    </div>
  );
}
