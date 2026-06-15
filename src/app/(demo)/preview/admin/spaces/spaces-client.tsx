"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowRight,
  Building2,
  ChevronDown,
  Edit2,
  LayoutGrid,
  List,
  MapPin,
  MoreHorizontal,
  Plus,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Space } from "@/lib/mock/admin"
import { DataToolbar } from "@/components/data-toolbar"
import { EntitySheet } from "@/components/entity-sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { SortableTable, type SortableColumn } from "@/components/sortable-table"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = "cards" | "table"

type SpaceForm = {
  name: string
  description: string
  seatedCapacity: string
  standingCapacity: string
  ceremonyCapacity: string
  indoorOutdoor: Space["indoorOutdoor"]
}

const EMPTY_FORM: SpaceForm = {
  name: "",
  description: "",
  seatedCapacity: "",
  standingCapacity: "",
  ceremonyCapacity: "",
  indoorOutdoor: "indoor",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function indoorOutdoorLabel(val: Space["indoorOutdoor"]) {
  if (val === "indoor") return "Indoor"
  if (val === "outdoor") return "Outdoor"
  return "Indoor / outdoor"
}

function indoorOutdoorBadgeVariant(val: Space["indoorOutdoor"]) {
  if (val === "indoor") return "blue" as const
  if (val === "outdoor") return "success" as const
  return "teal" as const
}

// ---------------------------------------------------------------------------
// Space form fields (used inside EntitySheet for both add and edit)
// ---------------------------------------------------------------------------

function SpaceFormFields({
  form,
  onChange,
}: {
  form: SpaceForm
  onChange: (patch: Partial<SpaceForm>) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="space-name">
          Space name <span aria-hidden className="text-destructive">*</span>
        </Label>
        <Input
          id="space-name"
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. The Long Barn"
          className="text-base"
        />
      </div>

      {/* Description */}
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

      {/* Indoor / outdoor */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="space-type">Type</Label>
        <Select
          value={form.indoorOutdoor}
          onValueChange={(v) =>
            onChange({ indoorOutdoor: v as Space["indoorOutdoor"] })
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

      {/* Capacities */}
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-foreground">Capacities</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="cap-seated" className="text-xs text-muted-foreground">
              Seated
            </Label>
            <Input
              id="cap-seated"
              type="number"
              min={0}
              value={form.seatedCapacity}
              onChange={(e) => onChange({ seatedCapacity: e.target.value })}
              placeholder="140"
              className="text-base tabular-nums"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="cap-standing" className="text-xs text-muted-foreground">
              Standing
            </Label>
            <Input
              id="cap-standing"
              type="number"
              min={0}
              value={form.standingCapacity}
              onChange={(e) => onChange({ standingCapacity: e.target.value })}
              placeholder="220"
              className="text-base tabular-nums"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="cap-ceremony" className="text-xs text-muted-foreground">
              Ceremony
            </Label>
            <Input
              id="cap-ceremony"
              type="number"
              min={0}
              value={form.ceremonyCapacity}
              onChange={(e) => onChange({ ceremonyCapacity: e.target.value })}
              placeholder="150"
              className="text-base tabular-nums"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Space card
// ---------------------------------------------------------------------------

function SpaceCard({
  space,
  onEdit,
  onArchive,
}: {
  space: Space
  onEdit: (space: Space) => void
  onArchive: (space: Space) => void
}) {
  return (
    <Card className="group/card flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      {/* Photo area */}
      <div className="relative h-40 w-full overflow-hidden bg-muted">
        {/* Placeholder gradient — in production this would be a real <Image /> */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-0",
            space.indoorOutdoor === "indoor"
              ? "bg-gradient-to-br from-fun-blue/30 to-fun-teal/20"
              : space.indoorOutdoor === "outdoor"
              ? "bg-gradient-to-br from-fun-green/30 to-mint/30"
              : "bg-gradient-to-br from-fun-pink/20 to-fun-blue/20",
          )}
        />
        <Building2
          aria-hidden
          className="absolute inset-0 m-auto size-12 text-muted-foreground/30"
        />

        {/* Type badge — top left */}
        <div className="absolute left-3 top-3">
          <Badge variant={indoorOutdoorBadgeVariant(space.indoorOutdoor)}>
            <MapPin aria-hidden />
            {indoorOutdoorLabel(space.indoorOutdoor)}
          </Badge>
        </div>

        {/* Overflow menu — top right, visible on hover/focus */}
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
                <Link href={`/preview/admin/spaces/${space.id}/floor`}>
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
      </div>

      {/* Body */}
      <CardHeader className="px-4 pt-4 pb-0">
        <h3 className="text-sm font-semibold text-foreground leading-tight">
          {space.name}
        </h3>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 px-4 pt-2 pb-4">
        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {space.description}
        </p>

        {/* Capacity row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <CapStat label="Seated" value={space.seatedCapacity} />
          <CapStat label="Standing" value={space.standingCapacity} />
          <CapStat label="Ceremony" value={space.ceremonyCapacity} />
        </div>

        {/* Footer actions */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(space)}
            className="h-8 px-2 text-xs"
          >
            <Edit2 className="size-3" />
            Edit
          </Button>
          <Link
            href={`/preview/admin/spaces/${space.id}/floor`}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1",
              "text-xs font-medium text-primary",
              "transition-colors hover:bg-accent hover:text-accent-foreground",
              "min-h-[32px]",
            )}
          >
            Configure floor
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function CapStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <span className="tabular-nums text-sm font-semibold text-foreground">
        {value.toLocaleString()}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table columns definition
// ---------------------------------------------------------------------------

function buildColumns(
  onEdit: (s: Space) => void,
  onArchive: (s: Space) => void,
): SortableColumn<Space>[] {
  return [
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
      render: (s) => (
        <Badge variant={indoorOutdoorBadgeVariant(s.indoorOutdoor)}>
          {indoorOutdoorLabel(s.indoorOutdoor)}
        </Badge>
      ),
    },
    {
      key: "seated",
      header: "Seated",
      align: "right",
      sortable: true,
      sortValue: (s) => s.seatedCapacity,
      render: (s) => (
        <span className="tabular-nums text-sm">{s.seatedCapacity}</span>
      ),
    },
    {
      key: "standing",
      header: "Standing",
      align: "right",
      sortable: true,
      sortValue: (s) => s.standingCapacity,
      render: (s) => (
        <span className="tabular-nums text-sm">{s.standingCapacity}</span>
      ),
    },
    {
      key: "ceremony",
      header: "Ceremony",
      align: "right",
      sortable: true,
      sortValue: (s) => s.ceremonyCapacity,
      render: (s) => (
        <span className="tabular-nums text-sm">{s.ceremonyCapacity}</span>
      ),
    },
    {
      key: "floor",
      header: "Floor plan",
      render: (s) => (
        <Link
          href={`/preview/admin/spaces/${s.id}/floor`}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Configure
          <ArrowRight className="size-3" />
        </Link>
      ),
    },
    {
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
              <Link href={`/preview/admin/spaces/${s.id}/floor`}>
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
    },
  ]
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function SpacesClient({ initialSpaces }: { initialSpaces: Space[] }) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [spaces, setSpaces] = React.useState<Space[]>(initialSpaces)
  const [search, setSearch] = React.useState("")
  const [view, setView] = React.useState<ViewMode>("cards")

  // Sheet state — null = closed / add mode; Space = edit mode
  const [editTarget, setEditTarget] = React.useState<Space | null>(null)
  const [addOpen, setAddOpen] = React.useState(false)
  const [form, setForm] = React.useState<SpaceForm>(EMPTY_FORM)

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return spaces
    return spaces.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    )
  }, [spaces, search])

  // ── Handlers ──────────────────────────────────────────────────────────────
  function openAdd() {
    setForm(EMPTY_FORM)
    setEditTarget(null)
    setAddOpen(true)
  }

  function openEdit(space: Space) {
    setForm({
      name: space.name,
      description: space.description,
      seatedCapacity: String(space.seatedCapacity),
      standingCapacity: String(space.standingCapacity),
      ceremonyCapacity: String(space.ceremonyCapacity),
      indoorOutdoor: space.indoorOutdoor,
    })
    setEditTarget(space)
    setAddOpen(true)
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast.error("Space name is required")
      return
    }

    const payload: Omit<Space, "id" | "order" | "photoUrl"> = {
      name: form.name.trim(),
      description: form.description.trim(),
      seatedCapacity: parseInt(form.seatedCapacity) || 0,
      standingCapacity: parseInt(form.standingCapacity) || 0,
      ceremonyCapacity: parseInt(form.ceremonyCapacity) || 0,
      indoorOutdoor: form.indoorOutdoor,
    }

    if (editTarget) {
      // Optimistic update
      setSpaces((prev) =>
        prev.map((s) =>
          s.id === editTarget.id ? { ...s, ...payload } : s,
        ),
      )
      toast.success(`"${payload.name}" updated`)
    } else {
      // Optimistic add
      const newSpace: Space = {
        id: `sp${Date.now()}`,
        photoUrl: "",
        order: spaces.length + 1,
        ...payload,
      }
      setSpaces((prev) => [...prev, newSpace])
      toast.success(`"${payload.name}" added`)
    }

    setAddOpen(false)
    setEditTarget(null)
  }

  function handleArchive(space: Space) {
    // Optimistic remove
    setSpaces((prev) => prev.filter((s) => s.id !== space.id))
    toast(`"${space.name}" archived`, {
      action: {
        label: "Undo",
        onClick: () =>
          setSpaces((prev) => {
            // Reinsert at original order position
            const next = [...prev, space]
            return next.sort((a, b) => a.order - b.order)
          }),
      },
    })
  }

  const tableColumns = React.useMemo(
    () => buildColumns(openEdit, handleArchive),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Page header — eyebrow + H2 (not PageHeader — admin content pattern) */}
      {/* ------------------------------------------------------------------ */}
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

      {/* ------------------------------------------------------------------ */}
      {/* Toolbar                                                              */}
      {/* ------------------------------------------------------------------ */}
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
          <Button size="sm" onClick={openAdd}>
            <Plus />
            Add space
          </Button>
        }
      />

      {/* ------------------------------------------------------------------ */}
      {/* Content                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="mt-4">
        {filtered.length === 0 ? (
          <EmptyState
            hasSearch={search.length > 0}
            onAdd={openAdd}
            onClearSearch={() => setSearch("")}
          />
        ) : view === "cards" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((space) => (
              <SpaceCard
                key={space.id}
                space={space}
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
                onAdd={openAdd}
                onClearSearch={() => setSearch("")}
              />
            }
          />
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Add / Edit sheet                                                     */}
      {/* ------------------------------------------------------------------ */}
      <AddEditSheet
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o)
          if (!o) setEditTarget(null)
        }}
        isEdit={editTarget !== null}
        form={form}
        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        onSave={handleSave}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Add / Edit sheet (extracted so it can manage its own Sheet open state via
// the controlled open/onOpenChange pattern — avoids the EntitySheet click-
// wrapper pattern which doesn't support programmatic open)
// ---------------------------------------------------------------------------

function AddEditSheet({
  open,
  onOpenChange,
  isEdit,
  form,
  onChange,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  isEdit: boolean
  form: SpaceForm
  onChange: (patch: Partial<SpaceForm>) => void
  onSave: () => void
}) {
  // Sheet primitives are imported at the top of the file.
  // EntitySheet's click-wrapper doesn't support programmatic open, so we
  // use the controlled Sheet pattern directly here.
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 sm:max-w-md"
      >
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
            <Button variant="ghost">Cancel</Button>
          </SheetClose>
          <Button onClick={onSave}>
            {isEdit ? "Save changes" : "Add space"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({
  hasSearch,
  onAdd,
  onClearSearch,
}: {
  hasSearch: boolean
  onAdd: () => void
  onClearSearch: () => void
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
            <p className="text-sm font-medium text-foreground">
              No spaces yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add the spaces couples can book — barns, orangeries, courtyards.
              Each gets its own floor plan.
            </p>
          </div>
          <Button size="sm" onClick={onAdd}>
            <Plus />
            Add your first space
          </Button>
        </>
      )}
    </div>
  )
}
