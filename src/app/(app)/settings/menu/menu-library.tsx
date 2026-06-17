"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  BookOpen,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { DataToolbar } from "@/components/data-toolbar";
import { EntitySheet } from "@/components/entity-sheet";
import { SortableTable, type SortableColumn } from "@/components/sortable-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createMenuItem,
  updateMenuItem,
  archiveMenuItem,
  type MenuItemRow,
} from "./actions";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COURSES = ["Starter", "Main", "Dessert", "Children", "Evening"] as const;
type Course = (typeof COURSES)[number];

// DB stores Title-case; spec says course is free-text Title-case
const COURSE_VALUES: Record<Course, string> = {
  Starter: "Starter",
  Main: "Main",
  Dessert: "Dessert",
  Children: "Children",
  Evening: "Evening",
};

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
] as const;

const ALL_DIETARY = [
  "Vegan",
  "Vegetarian",
  "Gluten-free",
  "Dairy-free",
  "Nut-free",
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format integer minor units (pence) as a display price string. */
function formatPrice(minor: number | null): string {
  if (minor === null || minor === 0) return "—";
  return `£${(minor / 100).toFixed(2).replace(/\.00$/, "")}`;
}

// ---------------------------------------------------------------------------
// Small chip components
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
  );
}

function DietaryChip({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-fun-teal px-1.5 py-0.5 text-[11px] font-medium text-foreground">
      {tag}
    </span>
  );
}

function CourseBadge({ course }: { course: string }) {
  const cls: Record<string, string> = {
    Starter: "bg-fun-blue text-foreground",
    Main: "bg-fun-green text-foreground",
    Dessert: "bg-fun-pink text-fun-pink-foreground",
    Children: "bg-mint text-foreground",
    Evening: "bg-warning text-warning-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        cls[course] ?? "bg-accent text-accent-foreground",
      )}
    >
      {course}
    </span>
  );
}

// ---------------------------------------------------------------------------
// DishFormState
// ---------------------------------------------------------------------------

interface DishFormState {
  name: string;
  course: string;
  description: string;
  pricePerHeadMinor: string;
  allergens: string[];
  dietary: string[];
  isActive: boolean;
}

function emptyForm(): DishFormState {
  return {
    name: "",
    course: "Starter",
    description: "",
    pricePerHeadMinor: "",
    allergens: [],
    dietary: [],
    isActive: true,
  };
}

function rowToForm(item: MenuItemRow): DishFormState {
  return {
    name: item.name,
    course: item.course,
    description: item.description ?? "",
    pricePerHeadMinor:
      item.price_per_head_minor != null && item.price_per_head_minor > 0
        ? String(item.price_per_head_minor)
        : "",
    allergens: [...item.allergens],
    dietary: [...item.dietary_tags],
    isActive: item.is_active,
  };
}

// ---------------------------------------------------------------------------
// ToggleChip
// ---------------------------------------------------------------------------

function ToggleChip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
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
  );
}

// ---------------------------------------------------------------------------
// DishForm
// ---------------------------------------------------------------------------

function DishForm({
  form,
  onChange,
}: {
  form: DishFormState;
  onChange: (patch: Partial<DishFormState>) => void;
}) {
  function toggleAllergen(a: string) {
    onChange({
      allergens: form.allergens.includes(a)
        ? form.allergens.filter((x) => x !== a)
        : [...form.allergens, a],
    });
  }

  function toggleDietary(d: string) {
    onChange({
      dietary: form.dietary.includes(d)
        ? form.dietary.filter((x) => x !== d)
        : [...form.dietary, d],
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="dish-name">Dish name</Label>
        <Input
          id="dish-name"
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Heritage tomato & burrata"
        />
      </div>

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
              <SelectItem key={c} value={COURSE_VALUES[c]}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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

      <div className="space-y-1.5">
        <Label htmlFor="dish-price">Price per head (pence)</Label>
        <Input
          id="dish-price"
          type="number"
          min="0"
          step="50"
          value={form.pricePerHeadMinor}
          onChange={(e) => onChange({ pricePerHeadMinor: e.target.value })}
          placeholder="e.g. 1200 for £12"
        />
        <p className="text-[11px] text-muted-foreground">
          Enter in pence (integer). 1200 = £12.00.
        </p>
      </div>

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

      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">Active in library</p>
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
  );
}

// ---------------------------------------------------------------------------
// AddDishSheet
// ---------------------------------------------------------------------------

function AddDishSheet({ onCommit }: { onCommit: (form: DishFormState) => void }) {
  const [form, setForm] = React.useState<DishFormState>(emptyForm);

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
        onCommit(form);
        setForm(emptyForm());
      }}
    >
      <DishForm form={form} onChange={(p) => setForm((prev) => ({ ...prev, ...p }))} />
    </EntitySheet>
  );
}

// ---------------------------------------------------------------------------
// EditDishSheet
// ---------------------------------------------------------------------------

function EditDishSheet({
  item,
  onCommit,
}: {
  item: MenuItemRow;
  onCommit: (id: string, form: DishFormState) => void;
}) {
  const [form, setForm] = React.useState<DishFormState>(() => rowToForm(item));

  const [prevItemId, setPrevItemId] = React.useState(item.id);
  if (item.id !== prevItemId) {
    setPrevItemId(item.id);
    setForm(rowToForm(item));
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
      description="Changes propagate to all menus that include this dish."
      saveLabel="Save changes"
      onSave={() => onCommit(item.id, form)}
    >
      <DishForm form={form} onChange={(p) => setForm((prev) => ({ ...prev, ...p }))} />
    </EntitySheet>
  );
}

// ---------------------------------------------------------------------------
// TableView
// ---------------------------------------------------------------------------

function TableView({
  rows,
  onEdit,
  onArchive,
}: {
  rows: MenuItemRow[];
  onEdit: (id: string, form: DishFormState) => void;
  onArchive: (item: MenuItemRow) => void;
}) {
  const columns: SortableColumn<MenuItemRow>[] = [
    {
      key: "name",
      header: "Dish",
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-3 py-0.5">
          {item.photo_path ? (
            <div className="relative size-9 shrink-0 overflow-hidden rounded-md">
              <Image
                src={item.photo_path}
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
            <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
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
      key: "dietary_tags",
      header: "Dietary",
      render: (item) =>
        item.dietary_tags.length === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {item.dietary_tags.map((d) => (
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
      key: "price_per_head_minor",
      header: "Price/head",
      sortable: true,
      align: "right",
      sortValue: (item) => item.price_per_head_minor ?? 0,
      render: (item) => (
        <span className="tabular-nums text-sm text-foreground">
          {formatPrice(item.price_per_head_minor)}
        </span>
      ),
    },
    {
      key: "is_active",
      header: "Status",
      sortable: true,
      sortValue: (item) => (item.is_active ? 0 : 1),
      render: (item) =>
        item.is_active ? (
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
          {item.is_active && (
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
  ];

  return (
    <SortableTable<MenuItemRow>
      columns={columns}
      rows={rows}
      getRowId={(item) => item.id}
      initialSort={{ key: "course", dir: "asc" }}
      stickyHeader
      emptyState={
        <div className="py-12 text-center">
          <Utensils className="mx-auto mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">No dishes match your search</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different term or clear the filter.
          </p>
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// CardView
// ---------------------------------------------------------------------------

function CardView({
  rows,
  onEdit,
  onArchive,
}: {
  rows: MenuItemRow[];
  onEdit: (id: string, form: DishFormState) => void;
  onArchive: (item: MenuItemRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center">
        <Utensils className="mx-auto mb-3 size-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">No dishes match your search</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try a different term or clear the filter.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((item) => (
        <div
          key={item.id}
          className={cn(
            "group rounded-xl border border-border bg-card shadow-sm overflow-hidden",
            "transition-all hover:-translate-y-0.5 hover:shadow-md",
            !item.is_active && "opacity-60",
          )}
        >
          <div className="relative h-36 bg-muted">
            {item.photo_path ? (
              <Image
                src={item.photo_path}
                alt={item.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Utensils className="size-8 text-muted-foreground/30" aria-hidden />
              </div>
            )}
            <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium text-foreground backdrop-blur-sm">
              {item.course}
            </span>
            {!item.is_active && (
              <span className="absolute right-2 top-2 rounded-full bg-muted/90 px-2 py-0.5 text-[11px] font-medium text-muted-foreground backdrop-blur-sm">
                Archived
              </span>
            )}
          </div>

          <div className="p-3 space-y-2">
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">{item.name}</p>
              {item.description && (
                <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                  {item.description}
                </p>
              )}
            </div>

            {item.allergens.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.allergens.map((a) => (
                  <AllergenChip key={a} allergen={a} />
                ))}
              </div>
            )}

            {item.dietary_tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.dietary_tags.map((d) => (
                  <DietaryChip key={d} tag={d} />
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-border">
              <span className="tabular-nums text-xs font-medium text-foreground">
                {formatPrice(item.price_per_head_minor)}/head
              </span>
              <div className="flex items-center gap-1">
                <EditDishSheet item={item} onCommit={onEdit} />
                {item.is_active && (
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
  );
}

// ---------------------------------------------------------------------------
// MenuLibraryClient — root export
// ---------------------------------------------------------------------------

export interface MenuLibraryClientProps {
  initialItems: MenuItemRow[];
  canManage: boolean;
}

export function MenuLibraryClient({
  initialItems,
  canManage,
}: MenuLibraryClientProps) {
  const router = useRouter();
  const [items, setItems] = React.useState<MenuItemRow[]>(initialItems);
  const [search, setSearch] = React.useState("");
  const [courseFilter, setCourseFilter] = React.useState<string>("all");
  const [view, setView] = React.useState<"table" | "card">("table");
  const [sortKey, setSortKey] = React.useState("course");

  // Derived
  const filteredItems = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((item) => {
      const matchesCourse =
        courseFilter === "all" || item.course === courseFilter;
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.course.toLowerCase().includes(q) ||
        (item.description ?? "").toLowerCase().includes(q) ||
        item.allergens.some((a) => a.toLowerCase().includes(q)) ||
        item.dietary_tags.some((d) => d.toLowerCase().includes(q));
      return matchesCourse && matchesSearch;
    });
  }, [items, search, courseFilter]);

  const sortedItems = React.useMemo(() => {
    if (view === "table") return filteredItems;
    return [...filteredItems].sort((a, b) => {
      if (sortKey === "course") {
        const ai = COURSES.indexOf(a.course as Course);
        const bi = COURSES.indexOf(b.course as Course);
        return ai - bi;
      }
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "price")
        return (a.price_per_head_minor ?? 0) - (b.price_per_head_minor ?? 0);
      return 0;
    });
  }, [filteredItems, sortKey, view]);

  // Handlers
  async function handleAdd(form: DishFormState) {
    if (!canManage) return;
    const result = await createMenuItem({
      name: form.name.trim() || "Unnamed dish",
      course: form.course,
      description: form.description.trim(),
      price_per_head_minor: form.pricePerHeadMinor
        ? parseInt(form.pricePerHeadMinor, 10)
        : null,
      allergens: form.allergens,
      dietary_tags: form.dietary,
      is_active: form.isActive,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setItems((prev) => [...prev, result.data]);
    toast.success(`"${result.data.name}" added to library`);
    router.refresh();
  }

  async function handleEdit(id: string, form: DishFormState) {
    if (!canManage) return;
    const result = await updateMenuItem(id, {
      name: form.name.trim() || undefined,
      course: form.course,
      description: form.description.trim(),
      price_per_head_minor: form.pricePerHeadMinor
        ? parseInt(form.pricePerHeadMinor, 10)
        : null,
      allergens: form.allergens,
      dietary_tags: form.dietary,
      is_active: form.isActive,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.id === id ? result.data : item)),
    );
    toast.success(`"${result.data.name}" updated`);
    router.refresh();
  }

  async function handleArchive(item: MenuItemRow) {
    if (!canManage) return;
    const result = await archiveMenuItem(item.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_active: false } : i)),
    );
    toast.success(`"${item.name}" archived — hidden from wedding menu builders`);
    router.refresh();
  }

  const activeCount = items.filter((i) => i.is_active).length;
  const archivedCount = items.length - activeCount;

  return (
    <div className="space-y-6">
      {/* Page header */}
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
          {canManage && <AddDishSheet onCommit={handleAdd} />}
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
            const n = items.filter((it) => it.course === c && it.is_active).length;
            if (n === 0) return null;
            return (
              <React.Fragment key={c}>
                {i > 0 && n > 0 ? " · " : ""}
                <span className="tabular-nums font-semibold text-foreground">
                  {n}
                </span>{" "}
                {c.toLowerCase()}
                {n !== 1 ? "s" : ""}
              </React.Fragment>
            );
          })}
        </p>
      </div>

      {/* Toolbar */}
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
            onClick={() => setCourseFilter(name === courseFilter ? "all" : name)}
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
      {view === "table" ? (
        <TableView
          rows={filteredItems}
          onEdit={handleEdit}
          onArchive={handleArchive}
        />
      ) : (
        <CardView
          rows={sortedItems}
          onEdit={handleEdit}
          onArchive={handleArchive}
        />
      )}

      {/* Empty catalogue state */}
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
          {canManage && (
            <div className="mt-4 flex justify-center">
              <AddDishSheet onCommit={handleAdd} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
