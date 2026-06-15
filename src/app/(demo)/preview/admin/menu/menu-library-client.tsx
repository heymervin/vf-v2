"use client"

import * as React from "react"
import Image from "next/image"
import {
  AlertTriangle,
  Archive,
  BookOpen,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Utensils,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { DataToolbar } from "@/components/data-toolbar"
import { EntitySheet } from "@/components/entity-sheet"
import { SortableTable, type SortableColumn } from "@/components/sortable-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { MenuLibraryItem } from "@/lib/mock"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COURSES = ["Starter", "Main", "Dessert", "Children", "Evening"] as const
type Course = (typeof COURSES)[number]

const ALL_ALLERGENS = [
  "Celery",
  "Crustaceans",
  "Dairy",
  "Egg",
  "Fish",
  "Gluten",
  "Lupin",
  "Molluscs",
  "Mustard",
  "Nuts",
  "Peanuts",
  "Sesame",
  "Soya",
  "Sulphites",
] as const

const ALL_DIETARY = [
  "Vegan",
  "Vegetarian",
  "Gluten-free",
  "Dairy-free",
  "Nut-free",
] as const

// ---------------------------------------------------------------------------
// Small chip helpers
// ---------------------------------------------------------------------------

function AllergenChip({ allergen }: { allergen: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-warning px-1.5 py-0.5 text-[11px] font-medium text-warning-foreground"
      aria-label={`Contains ${allergen}`}
    >
      <AlertTriangle className="size-3 shrink-0" aria-hidden />
      {allergen}
    </span>
  )
}

function DietaryChip({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-fun-teal px-1.5 py-0.5 text-[11px] font-medium text-foreground">
      {tag}
    </span>
  )
}

function CourseBadge({ course }: { course: string }) {
  const cls: Record<string, string> = {
    Starter: "bg-fun-blue text-foreground",
    Main: "bg-fun-green text-foreground",
    Dessert: "bg-fun-pink text-fun-pink-foreground",
    Children: "bg-mint text-foreground",
    Evening: "bg-warning text-warning-foreground",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        cls[course] ?? "bg-accent text-accent-foreground",
      )}
    >
      {course}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Dish form state
// ---------------------------------------------------------------------------

interface DishFormState {
  name: string
  course: string
  description: string
  pricePerHead: string
  photoUrl: string
  allergens: string[]
  dietary: string[]
  isActive: boolean
}

function emptyForm(): DishFormState {
  return {
    name: "",
    course: "Starter",
    description: "",
    pricePerHead: "",
    photoUrl: "",
    allergens: [],
    dietary: [],
    isActive: true,
  }
}

function itemToForm(item: MenuLibraryItem): DishFormState {
  return {
    name: item.name,
    course: item.course,
    description: item.description,
    pricePerHead: item.pricePerHead > 0 ? String(item.pricePerHead) : "",
    photoUrl: item.photoUrl ?? "",
    allergens: [...item.allergens],
    dietary: [...item.dietary],
    isActive: item.isActive,
  }
}

// ---------------------------------------------------------------------------
// ToggleChip — multi-select pill for allergens / dietary
// ---------------------------------------------------------------------------

function ToggleChip({
  label,
  selected,
  onToggle,
}: {
  label: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors min-h-[32px]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// DishForm — controlled form content for the EntitySheet body
// ---------------------------------------------------------------------------

function DishForm({
  form,
  onChange,
}: {
  form: DishFormState
  onChange: (patch: Partial<DishFormState>) => void
}) {
  function toggleAllergen(a: string) {
    onChange({
      allergens: form.allergens.includes(a)
        ? form.allergens.filter((x) => x !== a)
        : [...form.allergens, a],
    })
  }

  function toggleDietary(d: string) {
    onChange({
      dietary: form.dietary.includes(d)
        ? form.dietary.filter((x) => x !== d)
        : [...form.dietary, d],
    })
  }

  return (
    <div className="space-y-5">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="dish-name">Dish name</Label>
        <Input
          id="dish-name"
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Heritage tomato & burrata"
        />
      </div>

      {/* Course */}
      <div className="space-y-1.5">
        <Label htmlFor="dish-course">Course</Label>
        <Select
          value={form.course}
          onValueChange={(v) => onChange({ course: v })}
        >
          <SelectTrigger id="dish-course" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COURSES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="dish-description">Description</Label>
        <Textarea
          id="dish-description"
          value={form.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Short description for menus and the couple portal…"
          className="min-h-[72px]"
        />
      </div>

      {/* Price / head */}
      <div className="space-y-1.5">
        <Label htmlFor="dish-price">Price per head (£)</Label>
        <Input
          id="dish-price"
          type="number"
          min="0"
          step="0.50"
          value={form.pricePerHead}
          onChange={(e) => onChange({ pricePerHead: e.target.value })}
          placeholder="e.g. 12"
        />
      </div>

      {/* Photo URL */}
      <div className="space-y-1.5">
        <Label htmlFor="dish-photo">Photo URL</Label>
        <Input
          id="dish-photo"
          value={form.photoUrl}
          onChange={(e) => onChange({ photoUrl: e.target.value })}
          placeholder="/dishes/heritage-tomato-burrata.jpg"
        />
        <p className="text-[11px] text-muted-foreground">
          Shown on wedding menus and the couple portal.
        </p>
      </div>

      {/* Allergens */}
      <div className="space-y-2">
        <Label>
          Allergens{" "}
          <span className="text-[11px] font-normal text-muted-foreground">
            (Natasha&apos;s Law — 14 declarable allergens)
          </span>
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {ALL_ALLERGENS.map((a) => (
            <ToggleChip
              key={a}
              label={a}
              selected={form.allergens.includes(a)}
              onToggle={() => toggleAllergen(a)}
            />
          ))}
        </div>
      </div>

      {/* Dietary tags */}
      <div className="space-y-2">
        <Label>Dietary tags</Label>
        <div className="flex flex-wrap gap-1.5">
          {ALL_DIETARY.map((d) => (
            <ToggleChip
              key={d}
              label={d}
              selected={form.dietary.includes(d)}
              onToggle={() => toggleDietary(d)}
            />
          ))}
        </div>
      </div>

      {/* Active toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">
            Active in library
          </p>
          <p className="text-[11px] text-muted-foreground">
            Inactive dishes are hidden when building per-wedding menus.
          </p>
        </div>
        <Switch
          checked={form.isActive}
          onCheckedChange={(v) => onChange({ isActive: v })}
          aria-label="Active in library"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AddDishSheet — stateful wrapper that resets form on each open
// ---------------------------------------------------------------------------

function AddDishSheet({
  onCommit,
}: {
  onCommit: (form: DishFormState) => void
}) {
  const [form, setForm] = React.useState<DishFormState>(emptyForm)

  return (
    <EntitySheet
      trigger={
        <Button variant="default" size="default" className="shrink-0">
          <Plus className="size-4" aria-hidden />
          Add dish
        </Button>
      }
      title="Add dish to library"
      description="New dishes are immediately available when building wedding menus."
      saveLabel="Save dish"
      onSave={() => {
        onCommit(form)
        setForm(emptyForm())
      }}
    >
      <DishForm form={form} onChange={(p) => setForm((prev) => ({ ...prev, ...p }))} />
    </EntitySheet>
  )
}

// ---------------------------------------------------------------------------
// EditDishSheet — per-row, initialises form from the item on every render
// ---------------------------------------------------------------------------

function EditDishSheet({
  item,
  onCommit,
}: {
  item: MenuLibraryItem
  onCommit: (id: string, form: DishFormState) => void
}) {
  const [form, setForm] = React.useState<DishFormState>(() => itemToForm(item))

  // Re-init when a different item is passed in (adjust-during-render pattern,
  // not an effect — avoids cascading-render lint).
  const [prevItemId, setPrevItemId] = React.useState(item.id)
  if (item.id !== prevItemId) {
    setPrevItemId(item.id)
    setForm(itemToForm(item))
  }

  return (
    <EntitySheet
      trigger={
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          aria-label={`Edit ${item.name}`}
        >
          <Pencil className="size-3.5" aria-hidden />
          Edit
        </Button>
      }
      title={`Edit: ${item.name}`}
      description="Changes are saved to the library immediately."
      saveLabel="Save changes"
      onSave={() => onCommit(item.id, form)}
    >
      <DishForm form={form} onChange={(p) => setForm((prev) => ({ ...prev, ...p }))} />
    </EntitySheet>
  )
}

// ---------------------------------------------------------------------------
// Table view
// ---------------------------------------------------------------------------

function TableView({
  rows,
  onEdit,
  onArchive,
}: {
  rows: MenuLibraryItem[]
  onEdit: (id: string, form: DishFormState) => void
  onArchive: (item: MenuLibraryItem) => void
}) {
  const columns: SortableColumn<MenuLibraryItem>[] = [
    {
      key: "name",
      header: "Dish",
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-3 py-0.5">
          {item.photoUrl ? (
            <div className="relative size-9 shrink-0 overflow-hidden rounded-md">
              <Image
                src={item.photoUrl}
                alt={item.name}
                fill
                className="object-cover"
                sizes="36px"
              />
            </div>
          ) : (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
              <Utensils className="size-4 text-muted-foreground/50" aria-hidden />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {item.name}
            </p>
            {item.description && (
              <p className="truncate text-[11px] text-muted-foreground max-w-[220px]">
                {item.description}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "course",
      header: "Course",
      sortable: true,
      className: "whitespace-nowrap",
      render: (item) => <CourseBadge course={item.course} />,
    },
    {
      key: "dietary",
      header: "Dietary",
      render: (item) =>
        item.dietary.length === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {item.dietary.map((d) => (
              <DietaryChip key={d} tag={d} />
            ))}
          </div>
        ),
    },
    {
      key: "allergens",
      header: "Allergens",
      render: (item) =>
        item.allergens.length === 0 ? (
          <span className="text-xs text-muted-foreground">None</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {item.allergens.map((a) => (
              <AllergenChip key={a} allergen={a} />
            ))}
          </div>
        ),
    },
    {
      key: "pricePerHead",
      header: "Price/head",
      sortable: true,
      align: "right",
      sortValue: (item) => item.pricePerHead,
      render: (item) => (
        <span className="tabular-nums text-sm text-foreground">
          £{item.pricePerHead}
        </span>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      sortable: true,
      sortValue: (item) => (item.isActive ? 0 : 1),
      render: (item) =>
        item.isActive ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="secondary">Archived</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      render: (item) => (
        <div className="flex items-center gap-1">
          <EditDishSheet item={item} onCommit={onEdit} />
          {item.isActive && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onArchive(item)}
              aria-label={`Archive ${item.name}`}
            >
              <Archive className="size-3.5" aria-hidden />
              Archive
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <SortableTable<MenuLibraryItem>
      columns={columns}
      rows={rows}
      getRowId={(item) => item.id}
      initialSort={{ key: "course", dir: "asc" }}
      stickyHeader
      emptyState={
        <div className="py-12 text-center">
          <Utensils className="mx-auto mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">
            No dishes match your search
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different term or clear the filter.
          </p>
        </div>
      }
    />
  )
}

// ---------------------------------------------------------------------------
// Card / photo view
// ---------------------------------------------------------------------------

function CardView({
  rows,
  onEdit,
  onArchive,
}: {
  rows: MenuLibraryItem[]
  onEdit: (id: string, form: DishFormState) => void
  onArchive: (item: MenuLibraryItem) => void
}) {
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center">
        <Utensils className="mx-auto mb-3 size-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">
          No dishes match your search
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try a different term or clear the filter.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((item) => (
        <div
          key={item.id}
          className={cn(
            "group rounded-xl border border-border bg-card shadow-sm overflow-hidden",
            "transition-all hover:-translate-y-0.5 hover:shadow-md",
            !item.isActive && "opacity-60",
          )}
        >
          {/* Photo / placeholder */}
          <div className="relative h-36 bg-muted">
            {item.photoUrl ? (
              <Image
                src={item.photoUrl}
                alt={item.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Utensils
                  className="size-8 text-muted-foreground/30"
                  aria-hidden
                />
              </div>
            )}
            {/* Course overlay */}
            <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium text-foreground backdrop-blur-sm">
              {item.course}
            </span>
            {/* Archived overlay */}
            {!item.isActive && (
              <span className="absolute right-2 top-2 rounded-full bg-muted/90 px-2 py-0.5 text-[11px] font-medium text-muted-foreground backdrop-blur-sm">
                Archived
              </span>
            )}
          </div>

          {/* Body */}
          <div className="p-3 space-y-2">
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">
                {item.name}
              </p>
              {item.description && (
                <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                  {item.description}
                </p>
              )}
            </div>

            {/* Allergens */}
            {item.allergens.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.allergens.map((a) => (
                  <AllergenChip key={a} allergen={a} />
                ))}
              </div>
            )}

            {/* Dietary */}
            {item.dietary.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.dietary.map((d) => (
                  <DietaryChip key={d} tag={d} />
                ))}
              </div>
            )}

            {/* Footer: price + actions */}
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <span className="tabular-nums text-xs font-medium text-foreground">
                £{item.pricePerHead}/head
              </span>
              <div className="flex items-center gap-1">
                <EditDishSheet item={item} onCommit={onEdit} />
                {item.isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => onArchive(item)}
                    aria-label={`Archive ${item.name}`}
                  >
                    <Archive className="size-3" aria-hidden />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root client component
// ---------------------------------------------------------------------------

export interface MenuLibraryClientProps {
  initialItems: MenuLibraryItem[]
}

export function MenuLibraryClient({ initialItems }: MenuLibraryClientProps) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [items, setItems] = React.useState<MenuLibraryItem[]>(initialItems)
  const [search, setSearch] = React.useState("")
  const [courseFilter, setCourseFilter] = React.useState<string>("all")
  const [view, setView] = React.useState<"table" | "card">("table")
  const [sortKey, setSortKey] = React.useState("course")

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredItems = React.useMemo(() => {
    const q = search.toLowerCase().trim()
    return items.filter((item) => {
      const matchesCourse =
        courseFilter === "all" || item.course === courseFilter
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.course.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.allergens.some((a) => a.toLowerCase().includes(q)) ||
        item.dietary.some((d) => d.toLowerCase().includes(q))
      return matchesCourse && matchesSearch
    })
  }, [items, search, courseFilter])

  const sortedItems = React.useMemo(() => {
    // Table view: SortableTable handles sorting internally.
    if (view === "table") return filteredItems
    return [...filteredItems].sort((a, b) => {
      if (sortKey === "course")
        return (
          COURSES.indexOf(a.course as Course) -
          COURSES.indexOf(b.course as Course)
        )
      if (sortKey === "name") return a.name.localeCompare(b.name)
      if (sortKey === "price") return a.pricePerHead - b.pricePerHead
      return 0
    })
  }, [filteredItems, sortKey, view])

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleAdd(form: DishFormState) {
    const next: MenuLibraryItem = {
      id: `ml-new-${Date.now()}`,
      name: form.name.trim() || "Unnamed dish",
      course: form.course,
      description: form.description.trim(),
      allergens: form.allergens,
      dietary: form.dietary,
      pricePerHead: Number(form.pricePerHead) || 0,
      photoUrl: form.photoUrl.trim() || null,
      isActive: form.isActive,
    }
    setItems((prev) => [...prev, next])
    toast(`"${next.name}" added to library`)
  }

  function handleEdit(id: string, form: DishFormState) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              name: form.name.trim() || item.name,
              course: form.course,
              description: form.description.trim(),
              allergens: form.allergens,
              dietary: form.dietary,
              pricePerHead: Number(form.pricePerHead) || item.pricePerHead,
              photoUrl: form.photoUrl.trim() || null,
              isActive: form.isActive,
            }
          : item,
      ),
    )
    toast(`"${form.name}" updated`)
  }

  function handleArchive(item: MenuLibraryItem) {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isActive: false } : i)),
    )
    toast(`"${item.name}" archived — hidden from wedding menu builders`)
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const activeCount = items.filter((i) => i.isActive).length
  const archivedCount = items.length - activeCount

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header — eyebrow + H2 per admin content convention (no PageHeader) */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Catering
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-[-0.022em] text-foreground">
              Menu library
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Your reusable dish catalogue. Active dishes appear when building
              per-wedding menus. All 14 Natasha&apos;s Law allergens are
              declarable per dish.
            </p>
          </div>
          <AddDishSheet onCommit={handleAdd} />
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <BookOpen className="size-4 text-muted-foreground" aria-hidden />
          <span className="tabular-nums font-semibold text-foreground">
            {items.length}
          </span>
          <span className="text-muted-foreground">dishes total</span>
        </div>
        <div className="h-4 w-px bg-border hidden sm:block" aria-hidden />
        <p className="text-sm">
          <span className="tabular-nums font-semibold text-foreground">
            {activeCount}
          </span>
          <span className="text-muted-foreground"> active</span>
          {archivedCount > 0 && (
            <>
              {" · "}
              <span className="tabular-nums font-semibold text-foreground">
                {archivedCount}
              </span>
              <span className="text-muted-foreground"> archived</span>
            </>
          )}
        </p>
        <div className="h-4 w-px bg-border hidden sm:block" aria-hidden />
        <p className="text-sm text-muted-foreground">
          {COURSES.map((c, i) => {
            const n = items.filter((it) => it.course === c && it.isActive).length
            if (n === 0) return null
            return (
              <React.Fragment key={c}>
                {i > 0 && n > 0 ? " · " : ""}
                <span className="tabular-nums font-semibold text-foreground">
                  {n}
                </span>{" "}
                {c.toLowerCase()}
                {n !== 1 ? "s" : ""}
              </React.Fragment>
            )
          })}
        </p>
      </div>

      {/* DataToolbar */}
      <DataToolbar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search dishes, allergens, dietary…",
        }}
        sort={{
          value: sortKey,
          onChange: setSortKey,
          options: [
            { value: "course", label: "Course order" },
            { value: "name", label: "Name A–Z" },
            { value: "price", label: "Price/head" },
          ],
        }}
        view={{
          value: view,
          onChange: (v) => setView(v as "table" | "card"),
          options: [
            { value: "table", label: "Table view", icon: List },
            { value: "card", label: "Card / photo view", icon: LayoutGrid },
          ],
        }}
        resultCount={filteredItems.length}
        totalCount={items.length}
      >
        {/* Course filter chips */}
        <button
          type="button"
          onClick={() => setCourseFilter("all")}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors min-h-[32px]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            courseFilter === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          All courses
        </button>
        {COURSES.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() =>
              setCourseFilter(name === courseFilter ? "all" : name)
            }
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors min-h-[32px]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              courseFilter === name
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {name}
          </button>
        ))}
      </DataToolbar>

      {/* Main view */}
      {items.length > 0 && (view === "table" ? (
        <TableView
          rows={sortedItems}
          onEdit={handleEdit}
          onArchive={handleArchive}
        />
      ) : (
        <CardView
          rows={sortedItems}
          onEdit={handleEdit}
          onArchive={handleArchive}
        />
      ))}

      {/* Empty catalogue state — only shown when no items at all */}
      {items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <Utensils
            className="mx-auto mb-3 size-10 text-muted-foreground/30"
            aria-hidden
          />
          <p className="text-sm font-medium text-foreground">
            Your menu library is empty
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first dish to start building menus for couples.
          </p>
          <div className="mt-4 flex justify-center">
            <AddDishSheet onCommit={handleAdd} />
          </div>
        </div>
      )}
    </div>
  )
}
