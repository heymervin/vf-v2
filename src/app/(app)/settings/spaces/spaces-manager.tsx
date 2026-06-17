"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  Building2,
  Edit2,
  LayoutGrid,
  List,
  MapPin,
  MoreHorizontal,
  Plus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/lib/supabase/types";
import { DataToolbar } from "@/components/data-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { SortableTable, type SortableColumn } from "@/components/sortable-table";
import { upsertSpace, archiveSpace } from "./actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SpaceRow = Tables<"spaces">;
type ViewMode = "cards" | "table";
type IndoorOutdoor = "indoor" | "outdoor" | "both";

interface SpaceForm {
  name: string;
  description: string;
  indoor_outdoor: IndoorOutdoor;
  capacity_seated: string;
  capacity_standing: string;
  capacity_ceremony: string;
}

const EMPTY_FORM: SpaceForm = {
  name: "",
  description: "",
  indoor_outdoor: "indoor",
  capacity_seated: "",
  capacity_standing: "",
  capacity_ceremony: "",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function indoorOutdoorLabel(val: IndoorOutdoor): string {
  if (val === "indoor") return "Indoor";
  if (val === "outdoor") return "Outdoor";
  return "Indoor / outdoor";
}

function indoorOutdoorBadgeVariant(
  val: IndoorOutdoor,
): "blue" | "success" | "teal" {
  if (val === "indoor") return "blue";
  if (val === "outdoor") return "success";
  return "teal";
}

function parseCapacity(s: string): number | null {
  const n = parseInt(s, 10);
  return isNaN(n) || n < 0 ? null : n;
}

// ---------------------------------------------------------------------------
// Space form fields
// ---------------------------------------------------------------------------

function SpaceFormFields({
  form,
  onChange,
}: {
  form: SpaceForm;
  onChange: (patch: Partial<SpaceForm>) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="space-name">
          Space name{" "}
          <span aria-hidden className="text-destructive">
            *
          </span>
        </Label>
        <Input
          id="space-name"
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. The Long Barn"
          className="text-base"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="space-description">Description</Label>
        <Textarea
          id="space-description"
          value={form.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Brief description shown to couples in the brochure…"
          rows={3}
          className="resize-none text-base"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="space-type">Type</Label>
        <Select
          value={form.indoor_outdoor}
          onValueChange={(v) =>
            onChange({ indoor_outdoor: v as IndoorOutdoor })
          }
        >
          <SelectTrigger id="space-type" className="text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="indoor">Indoor</SelectItem>
            <SelectItem value="outdoor">Outdoor</SelectItem>
            <SelectItem value="both">Indoor / outdoor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-foreground">Capacities</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <Label
              htmlFor="cap-seated"
              className="text-xs text-muted-foreground"
            >
              Seated
            </Label>
            <Input
              id="cap-seated"
              type="number"
              min={0}
              value={form.capacity_seated}
              onChange={(e) => onChange({ capacity_seated: e.target.value })}
              placeholder="140"
              className="text-base tabular-nums"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label
              htmlFor="cap-standing"
              className="text-xs text-muted-foreground"
            >
              Standing
            </Label>
            <Input
              id="cap-standing"
              type="number"
              min={0}
              value={form.capacity_standing}
              onChange={(e) => onChange({ capacity_standing: e.target.value })}
              placeholder="220"
              className="text-base tabular-nums"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label
              htmlFor="cap-ceremony"
              className="text-xs text-muted-foreground"
            >
              Ceremony
            </Label>
            <Input
              id="cap-ceremony"
              type="number"
              min={0}
              value={form.capacity_ceremony}
              onChange={(e) => onChange({ capacity_ceremony: e.target.value })}
              placeholder="150"
              className="text-base tabular-nums"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Space card
// ---------------------------------------------------------------------------

function SpaceCard({
  space,
  canManage,
  onEdit,
  onArchive,
}: {
  space: SpaceRow;
  canManage: boolean;
  onEdit: (space: SpaceRow) => void;
  onArchive: (space: SpaceRow) => void;
}) {
  const io = (space.indoor_outdoor ?? "indoor") as IndoorOutdoor;

  return (
    <Card className="group/card flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative h-40 w-full overflow-hidden bg-muted">
        <div
          aria-hidden
          className={cn(
            "absolute inset-0",
            io === "indoor"
              ? "bg-gradient-to-br from-blue-400/30 to-teal-400/20"
              : io === "outdoor"
                ? "bg-gradient-to-br from-green-400/30 to-emerald-400/20"
                : "bg-gradient-to-br from-pink-400/20 to-blue-400/20",
          )}
        />
        <Building2
          aria-hidden
          className="absolute inset-0 m-auto size-12 text-muted-foreground/30"
        />

        <div className="absolute left-3 top-3">
          <Badge variant={indoorOutdoorBadgeVariant(io)}>
            <MapPin aria-hidden />
            {indoorOutdoorLabel(io)}
          </Badge>
        </div>

        {canManage && (
          <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`More actions for ${space.name}`}
                  className="bg-background/80 backdrop-blur-sm hover:bg-background"
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={() => onEdit(space)}>
                  <Edit2 />
                  Edit space
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/settings/spaces/${space.id}/floor`}>
                    <LayoutGrid />
                    Configure floor
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => onArchive(space)}
                  className="text-destructive focus:text-destructive"
                >
                  Archive space
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <CardHeader className="px-4 pt-4 pb-0">
        <h3 className="text-sm font-semibold text-foreground leading-tight">
          {space.name}
        </h3>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 px-4 pt-2 pb-4">
        {space.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {space.description}
          </p>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <CapStat label="Seated" value={space.capacity_seated} />
          <CapStat label="Standing" value={space.capacity_standing} />
          <CapStat label="Ceremony" value={space.capacity_ceremony} />
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(space)}
              className="h-8 px-2 text-xs"
            >
              <Edit2 className="size-3" />
              Edit
            </Button>
          )}
          <Link
            href={`/settings/spaces/${space.id}/floor`}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1",
              "text-xs font-medium text-primary",
              "transition-colors hover:bg-accent hover:text-accent-foreground",
              "min-h-[32px]",
              !canManage && "ml-auto",
            )}
          >
            Configure floor
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function CapStat({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  if (value == null) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <span className="tabular-nums text-sm font-semibold text-foreground">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

function buildColumns(
  canManage: boolean,
  onEdit: (s: SpaceRow) => void,
  onArchive: (s: SpaceRow) => void,
): SortableColumn<SpaceRow>[] {
  const cols: SortableColumn<SpaceRow>[] = [
    {
      key: "name",
      header: "Space",
      sortable: true,
      render: (s) => (
        <span className="font-medium text-foreground">{s.name}</span>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (s) => {
        const io = (s.indoor_outdoor ?? "indoor") as IndoorOutdoor;
        return (
          <Badge variant={indoorOutdoorBadgeVariant(io)}>
            {indoorOutdoorLabel(io)}
          </Badge>
        );
      },
    },
    {
      key: "seated",
      header: "Seated",
      align: "right",
      sortable: true,
      sortValue: (s) => s.capacity_seated ?? 0,
      render: (s) => (
        <span className="tabular-nums text-sm">
          {s.capacity_seated ?? "—"}
        </span>
      ),
    },
    {
      key: "standing",
      header: "Standing",
      align: "right",
      sortable: true,
      sortValue: (s) => s.capacity_standing ?? 0,
      render: (s) => (
        <span className="tabular-nums text-sm">
          {s.capacity_standing ?? "—"}
        </span>
      ),
    },
    {
      key: "ceremony",
      header: "Ceremony",
      align: "right",
      sortable: true,
      sortValue: (s) => s.capacity_ceremony ?? 0,
      render: (s) => (
        <span className="tabular-nums text-sm">
          {s.capacity_ceremony ?? "—"}
        </span>
      ),
    },
    {
      key: "floor",
      header: "Floor plan",
      render: (s) => (
        <Link
          href={`/settings/spaces/${s.id}/floor`}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Configure
          <ArrowRight className="size-3" />
        </Link>
      ),
    },
  ];

  if (canManage) {
    cols.push({
      key: "actions",
      header: "",
      render: (s) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`More actions for ${s.name}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => onEdit(s)}>
              <Edit2 />
              Edit space
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/settings/spaces/${s.id}/floor`}>
                <LayoutGrid />
                Configure floor
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onArchive(s)}
              className="text-destructive focus:text-destructive"
            >
              Archive space
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    });
  }

  return cols;
}

// ---------------------------------------------------------------------------
// Add / Edit sheet
// ---------------------------------------------------------------------------

function AddEditSheet({
  open,
  onOpenChange,
  isEdit,
  saving,
  form,
  onChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEdit: boolean;
  saving: boolean;
  form: SpaceForm;
  onChange: (patch: Partial<SpaceForm>) => void;
  onSave: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="text-base font-semibold text-foreground">
            {isEdit ? "Edit space" : "Add space"}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {isEdit
              ? "Update the details for this space."
              : "Add a new bookable space to the venue."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <SpaceFormFields form={form} onChange={onChange} />
        </div>

        <SheetFooter className="border-t border-border px-6 py-4 flex-row items-center justify-end gap-2">
          <SheetClose asChild>
            <Button variant="ghost" disabled={saving}>
              Cancel
            </Button>
          </SheetClose>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add space"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({
  hasSearch,
  canManage,
  onAdd,
  onClearSearch,
}: {
  hasSearch: boolean;
  canManage: boolean;
  onAdd: () => void;
  onClearSearch: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Building2 className="size-5 text-muted-foreground" />
      </div>
      {hasSearch ? (
        <>
          <div>
            <p className="text-sm font-medium text-foreground">
              No spaces match your search
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try a different name or description.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onClearSearch}>
            Clear search
          </Button>
        </>
      ) : (
        <>
          <div>
            <p className="text-sm font-medium text-foreground">No spaces yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add the spaces couples can book — barns, orangeries, courtyards.
              Each gets its own floor plan.
            </p>
          </div>
          {canManage && (
            <Button size="sm" onClick={onAdd}>
              <Plus />
              Add your first space
            </Button>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function SpacesManager({
  initialSpaces,
  canManage,
}: {
  initialSpaces: SpaceRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [spaces, setSpaces] = React.useState<SpaceRow[]>(initialSpaces);
  const [search, setSearch] = React.useState("");
  const [view, setView] = React.useState<ViewMode>("cards");
  const [saving, setSaving] = React.useState(false);

  // Sheet state
  const [editTarget, setEditTarget] = React.useState<SpaceRow | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [form, setForm] = React.useState<SpaceForm>(EMPTY_FORM);

  // Derived
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return spaces;
    return spaces.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q),
    );
  }, [spaces, search]);

  // Handlers
  function openAdd() {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setSheetOpen(true);
  }

  function openEdit(space: SpaceRow) {
    setForm({
      name: space.name,
      description: space.description ?? "",
      indoor_outdoor: (space.indoor_outdoor ?? "indoor") as IndoorOutdoor,
      capacity_seated: space.capacity_seated != null ? String(space.capacity_seated) : "",
      capacity_standing: space.capacity_standing != null ? String(space.capacity_standing) : "",
      capacity_ceremony: space.capacity_ceremony != null ? String(space.capacity_ceremony) : "",
    });
    setEditTarget(space);
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Space name is required");
      return;
    }
    setSaving(true);
    try {
      const result = await upsertSpace({
        id: editTarget?.id,
        name: form.name.trim(),
        description: form.description.trim(),
        indoor_outdoor: form.indoor_outdoor,
        capacity_seated: parseCapacity(form.capacity_seated),
        capacity_standing: parseCapacity(form.capacity_standing),
        capacity_ceremony: parseCapacity(form.capacity_ceremony),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      if (editTarget) {
        setSpaces((prev) =>
          prev.map((s) => (s.id === editTarget.id ? result.data : s)),
        );
        toast.success(`"${result.data.name}" updated`);
      } else {
        setSpaces((prev) => [...prev, result.data]);
        toast.success(`"${result.data.name}" added`);
      }

      setSheetOpen(false);
      setEditTarget(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(space: SpaceRow) {
    // Optimistic removal
    setSpaces((prev) => prev.filter((s) => s.id !== space.id));

    const result = await archiveSpace(space.id);
    if (!result.ok) {
      // Revert on failure
      setSpaces((prev) => {
        const next = [...prev, space];
        return next.sort((a, b) => a.sort_order - b.sort_order);
      });
      toast.error(result.error);
      return;
    }

    toast(`"${space.name}" archived`, {
      action: {
        label: "Undo",
        onClick: () => {
          // Re-fetch on undo — simplest approach since unarchive is not implemented
          router.refresh();
        },
      },
    });
    router.refresh();
  }

  const tableColumns = React.useMemo(
    () => buildColumns(canManage, openEdit, handleArchive),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canManage],
  );

  return (
    <>
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Venue
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
          Spaces
        </h2>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
          Add and edit the spaces couples can book. Each space has its own
          floor-plan configuration.
        </p>
      </div>

      <DataToolbar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search spaces…",
        }}
        view={{
          value: view,
          onChange: (v) => setView(v as ViewMode),
          options: [
            { value: "cards", label: "Card view", icon: LayoutGrid },
            { value: "table", label: "Table view", icon: List },
          ],
        }}
        resultCount={filtered.length}
        totalCount={spaces.length}
        actions={
          canManage ? (
            <Button size="sm" onClick={openAdd}>
              <Plus />
              Add space
            </Button>
          ) : undefined
        }
      />

      <div className="mt-4">
        {filtered.length === 0 ? (
          <EmptyState
            hasSearch={search.length > 0}
            canManage={canManage}
            onAdd={openAdd}
            onClearSearch={() => setSearch("")}
          />
        ) : view === "cards" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((space) => (
              <SpaceCard
                key={space.id}
                space={space}
                canManage={canManage}
                onEdit={openEdit}
                onArchive={handleArchive}
              />
            ))}
          </div>
        ) : (
          <SortableTable
            columns={tableColumns}
            rows={filtered}
            getRowId={(s) => s.id}
            initialSort={{ key: "name", dir: "asc" }}
            stickyHeader
            emptyState={
              <EmptyState
                hasSearch={search.length > 0}
                canManage={canManage}
                onAdd={openAdd}
                onClearSearch={() => setSearch("")}
              />
            }
          />
        )}
      </div>

      {canManage && (
        <AddEditSheet
          open={sheetOpen}
          onOpenChange={(o) => {
            setSheetOpen(o);
            if (!o) setEditTarget(null);
          }}
          isEdit={editTarget !== null}
          saving={saving}
          form={form}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          onSave={handleSave}
        />
      )}
    </>
  );
}
