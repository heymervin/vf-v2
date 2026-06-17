"use client";

import { useState, useCallback, useId } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  Info,
  LayoutTemplate,
  Pencil,
  Plus,
  Star,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EntitySheet } from "@/components/entity-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FloorCanvas } from "@/components/floorplan/floor-canvas";
import { ShapedTable } from "@/components/floorplan/shaped-table";
import type { Tables } from "@/lib/supabase/types";
import type { RoomElement } from "@/lib/mock/planning";
import {
  saveFloorTemplate,
  deleteFloorTemplate,
  setDefaultTemplate,
  type TableEntry,
} from "./actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FloorTemplateRow = Tables<"floor_templates">;
type TableShape = "round" | "banquet" | "square" | "top";

interface ConfigTable extends TableEntry {
  _removed?: boolean;
}

interface TableFormState {
  shape: TableShape;
  capacity: string;
  label: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHAPE_LABELS: Record<TableShape, string> = {
  round: "Round",
  banquet: "Banquet",
  square: "Square",
  top: "Top / head table",
};

const SHAPE_DESCRIPTIONS: Record<TableShape, string> = {
  round: "Classic circular dining table — seats 6–12",
  banquet: "Long rectangular table — seats 10–20",
  square: "Square table — seats 4–8",
  top: "Wide head table for the wedding party — seats 8–14",
};

const DEFAULT_CAPACITY: Record<TableShape, number> = {
  round: 10,
  banquet: 12,
  square: 8,
  top: 10,
};

const TABLE_SIZE = 100;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nextTableNumber(tables: ConfigTable[]): number {
  const active = tables.filter((t) => !t._removed);
  if (active.length === 0) return 1;
  return Math.max(...active.map((t) => t.tableNumber)) + 1;
}

function autoPosition(tables: ConfigTable[]): { x: number; y: number } {
  const active = tables.filter((t) => !t._removed);
  const col = active.length % 4;
  const row = Math.floor(active.length / 4);
  return { x: 20 + col * 20, y: 30 + row * 22 };
}

function layoutToTables(layout: unknown): ConfigTable[] {
  if (!Array.isArray(layout)) return [];
  return layout as ConfigTable[];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PresetPill({
  template,
  isActive,
  onLoad,
}: {
  template: FloorTemplateRow;
  isActive: boolean;
  onLoad: () => void;
}) {
  return (
    <button
      onClick={onLoad}
      aria-pressed={isActive}
      className={cn(
        "flex min-h-[44px] items-center gap-2.5 rounded-xl border px-4 py-2.5 text-left transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        isActive
          ? "border-primary/60 bg-primary/5 text-foreground shadow-sm"
          : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-accent/40 hover:shadow-sm",
      )}
    >
      {isActive ? (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary">
          <Check className="size-3 text-primary-foreground" />
        </span>
      ) : (
        <LayoutTemplate
          className={cn(
            "size-4 shrink-0",
            isActive ? "text-primary" : "text-muted-foreground",
          )}
        />
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium leading-tight">
          {template.name}
        </p>
        <p className="mt-0.5 tabular-nums text-[11px] text-muted-foreground">
          {template.table_count ?? 0} tables · {template.capacity ?? 0} cap.
          {template.is_default && (
            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-primary/70">
              default
            </span>
          )}
        </p>
      </div>
    </button>
  );
}

function ShapeSelector({
  value,
  onChange,
}: {
  value: TableShape;
  onChange: (v: TableShape) => void;
}) {
  const shapes: TableShape[] = ["round", "banquet", "square", "top"];
  return (
    <div className="flex flex-col gap-1.5">
      {shapes.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          aria-pressed={value === s}
          className={cn(
            "flex min-h-[44px] items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            value === s
              ? "border-primary/60 bg-primary/5"
              : "border-border bg-card hover:bg-accent/40",
          )}
        >
          <span
            className={cn(
              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              value === s
                ? "border-primary bg-primary"
                : "border-border bg-transparent",
            )}
          >
            {value === s && <span className="size-2 rounded-full bg-white" />}
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              {SHAPE_LABELS[s]}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {SHAPE_DESCRIPTIONS[s]}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

function TableForm({
  state,
  onChange,
  formId,
}: {
  state: TableFormState;
  onChange: (patch: Partial<TableFormState>) => void;
  formId: string;
}) {
  return (
    <form
      id={formId}
      className="flex flex-col gap-5"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="flex flex-col gap-2">
        <Label className="text-xs font-semibold">Table shape</Label>
        <ShapeSelector
          value={state.shape}
          onChange={(shape) =>
            onChange({ shape, capacity: String(DEFAULT_CAPACITY[shape]) })
          }
        />
      </div>

      <Separator />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${formId}-seats`} className="text-xs font-semibold">
          Seat count
        </Label>
        <Input
          id={`${formId}-seats`}
          type="number"
          min={2}
          max={30}
          value={state.capacity}
          onChange={(e) => onChange({ capacity: e.target.value })}
          className="tabular-nums"
          placeholder="10"
        />
        <p className="text-[11px] text-muted-foreground">
          Max seated guests at this table.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${formId}-label`} className="text-xs font-semibold">
          Label{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id={`${formId}-label`}
          value={state.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="e.g. Head table, Family — Smith"
          maxLength={60}
        />
      </div>
    </form>
  );
}

function TableRow({
  table,
  isSelected,
  onSelect,
  onEdit,
  onRemove,
}: {
  table: ConfigTable;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: (t: ConfigTable) => void;
  onRemove: () => void;
}) {
  const [editState, setEditState] = useState<TableFormState>({
    shape: table.shape,
    capacity: String(table.capacity),
    label: table.label ?? "",
  });
  const formId = useId();

  return (
    <li
      className={cn(
        "group flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-all duration-150",
        isSelected
          ? "border-primary/50 bg-primary/5 shadow-sm"
          : "border-transparent hover:border-border hover:bg-accent/30",
      )}
      onClick={onSelect}
      role="option"
      aria-selected={isSelected}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums transition-colors",
          isSelected
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {table.tableNumber}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {table.label ?? `Table ${table.tableNumber}`}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {SHAPE_LABELS[table.shape]} · {table.capacity} seats
        </p>
      </div>

      <div
        className={cn(
          "flex shrink-0 items-center gap-1 transition-opacity duration-100",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <EntitySheet
          trigger={
            <button
              aria-label={`Edit table ${table.tableNumber}`}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Pencil className="size-3.5" />
            </button>
          }
          title={`Edit table ${table.tableNumber}`}
          description={table.label ?? undefined}
          saveLabel="Save changes"
          onSave={() => {
            const capacity = parseInt(editState.capacity, 10);
            if (!isNaN(capacity) && capacity > 0) {
              onEdit({
                ...table,
                shape: editState.shape,
                capacity,
                label: editState.label.trim() || null,
              });
            }
            toast.success(`Table ${table.tableNumber} updated`);
          }}
        >
          <TableForm
            state={editState}
            onChange={(patch) => setEditState((prev) => ({ ...prev, ...patch }))}
            formId={formId}
          />
        </EntitySheet>

        <button
          aria-label={`Remove table ${table.tableNumber}`}
          onClick={onRemove}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </li>
  );
}

function EmptyCanvasHint() {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
      <Table2 className="size-8 text-muted-foreground/30" />
      <p className="text-sm font-medium text-muted-foreground/60">
        No tables placed yet
      </p>
      <p className="text-[11px] text-muted-foreground/40">
        Load a preset or add tables from the panel
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface FloorEditorProps {
  spaceId: string;
  spaceName: string;
  spaceSeatedCapacity: number | null;
  templates: FloorTemplateRow[];
  canManage: boolean;
}

export function FloorEditor({
  spaceId,
  spaceName,
  spaceSeatedCapacity,
  templates,
  canManage,
}: FloorEditorProps) {
  const router = useRouter();

  // Active template — start on the default or first
  const defaultTemplate =
    templates.find((t) => t.is_default) ?? templates[0] ?? null;

  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(
    defaultTemplate?.id ?? null,
  );
  const [tables, setTables] = useState<ConfigTable[]>(() =>
    defaultTemplate ? layoutToTables(defaultTemplate.layout) : [],
  );
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // New template name (when saving a brand-new one)
  const [newTemplateName, setNewTemplateName] = useState("");

  // Add table form
  const [addState, setAddState] = useState<TableFormState>({
    shape: "round",
    capacity: "10",
    label: "",
  });
  const addFormId = useId();

  // Derived
  const activeTables = tables.filter((t) => !t._removed);
  const selectedTable =
    activeTables.find((t) => t.id === selectedTableId) ?? null;
  const totalCapacity = activeTables.reduce((sum, t) => sum + t.capacity, 0);
  const isOver =
    spaceSeatedCapacity !== null && totalCapacity > spaceSeatedCapacity;

  // Handlers
  const handleLoadPreset = useCallback(
    (template: FloorTemplateRow) => {
      if (activeTemplateId === template.id) return;
      setTables(layoutToTables(template.layout));
      setActiveTemplateId(template.id);
      setSelectedTableId(null);
      toast.success(`Preset "${template.name}" loaded`, {
        description: `${template.table_count ?? 0} tables · ${template.capacity ?? 0} total capacity`,
      });
    },
    [activeTemplateId],
  );

  const handleAddTable = useCallback(() => {
    const capacity = parseInt(addState.capacity, 10);
    if (isNaN(capacity) || capacity < 1) {
      toast.error("Enter a valid seat count");
      return;
    }
    const { x, y } = autoPosition(tables);
    const tableNumber = nextTableNumber(tables);
    const newTable: ConfigTable = {
      id: `t-${Date.now()}`,
      tableNumber,
      shape: addState.shape,
      capacity,
      x,
      y,
      label: addState.label.trim() || null,
    };
    setTables((prev) => [...prev, newTable]);
    setSelectedTableId(newTable.id);
    setActiveTemplateId(null);
    toast.success(`Table ${tableNumber} added`);
    setAddState({ shape: "round", capacity: "10", label: "" });
  }, [addState, tables]);

  const handleEditTable = useCallback((id: string, patch: ConfigTable) => {
    setTables((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const handleRemoveTable = useCallback(
    (id: string) => {
      const t = tables.find((x) => x.id === id);
      setTables((prev) => prev.filter((x) => x.id !== id));
      if (selectedTableId === id) setSelectedTableId(null);
      setActiveTemplateId(null);
      toast(`Table ${t?.tableNumber ?? ""} removed`);
    },
    [tables, selectedTableId],
  );

  const handleSave = useCallback(async () => {
    if (!canManage) return;

    // Determine template name
    const activeTemplate = templates.find((t) => t.id === activeTemplateId);
    const templateName =
      activeTemplate?.name ??
      newTemplateName.trim() ??
      `${spaceName} layout`;

    if (!templateName) {
      toast.error("Enter a name for this template");
      return;
    }

    setSaving(true);
    try {
      const result = await saveFloorTemplate({
        id: activeTemplateId && activeTemplate ? activeTemplateId : undefined,
        spaceId,
        name: templateName,
        tables: activeTables.map((t) => ({
          id: t.id,
          tableNumber: t.tableNumber,
          shape: t.shape,
          capacity: t.capacity,
          x: t.x,
          y: t.y,
          label: t.label,
        })),
        isDefault: activeTemplate?.is_default ?? false,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setActiveTemplateId(result.data.id);
      toast.success("Template saved", {
        description: `${activeTables.length} tables · ${totalCapacity} seats`,
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [
    canManage,
    templates,
    activeTemplateId,
    newTemplateName,
    spaceName,
    spaceId,
    activeTables,
    totalCapacity,
    router,
  ]);

  const handleDelete = useCallback(
    async (templateId: string) => {
      const result = await deleteFloorTemplate({ templateId, spaceId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // If we deleted the active template, reset to first remaining
      if (templateId === activeTemplateId) {
        const remaining = templates.filter((t) => t.id !== templateId);
        const next = remaining[0] ?? null;
        setActiveTemplateId(next?.id ?? null);
        setTables(next ? layoutToTables(next.layout) : []);
      }
      toast.success("Template deleted");
      router.refresh();
    },
    [spaceId, activeTemplateId, templates, router],
  );

  const handleSetDefault = useCallback(
    async (templateId: string) => {
      const result = await setDefaultTemplate({ templateId, spaceId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Default template updated");
      router.refresh();
    },
    [spaceId, router],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Preset strip */}
      {templates.length > 0 && (
        <section aria-label="Layout presets">
          <div className="mb-2.5 flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Saved templates
            </p>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
              <Info className="size-3" aria-hidden />
              <span>Click to load a template onto the canvas</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {templates.map((tpl) => (
              <div key={tpl.id} className="flex items-center gap-1">
                <PresetPill
                  template={tpl}
                  isActive={activeTemplateId === tpl.id}
                  onLoad={() => handleLoadPreset(tpl)}
                />
                {canManage && (
                  <div className="flex flex-col gap-0.5">
                    {!tpl.is_default && (
                      <button
                        onClick={() => handleSetDefault(tpl.id)}
                        aria-label={`Set "${tpl.name}" as default`}
                        title="Set as default"
                        className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-primary"
                      >
                        <Star className="size-3" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(tpl.id)}
                      aria-label={`Delete template "${tpl.name}"`}
                      title="Delete template"
                      className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Canvas + panel */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Canvas side */}
        <div className="min-w-0 flex-1">
          {/* Summary strip */}
          <div className="mb-3 flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold tabular-nums text-foreground">
                {activeTables.length}
              </span>
              <span className="text-muted-foreground">
                {activeTables.length === 1 ? "table" : "tables"}
              </span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold tabular-nums text-foreground">
                {totalCapacity}
              </span>
              <span className="text-muted-foreground">total seats</span>
            </div>
            {spaceSeatedCapacity !== null && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold tabular-nums text-foreground">
                    {spaceSeatedCapacity}
                  </span>
                  <span className="text-muted-foreground">space capacity</span>
                </div>
              </>
            )}
            {isOver && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <Badge variant="warning" className="text-[10px]">
                  Over capacity
                </Badge>
              </>
            )}
            {canManage && (
              <div className="ml-auto">
                <Button
                  variant="default"
                  size="sm"
                  className="h-8"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save template"}
                </Button>
              </div>
            )}
          </div>

          {/* Floor canvas */}
          <FloorCanvas roomElements={[]} className="shadow-sm">
            {activeTables.length === 0 && <EmptyCanvasHint />}
            {activeTables.map((ft) => {
              const isSelected = selectedTableId === ft.id;
              return (
                <div
                  key={ft.id}
                  className="absolute"
                  style={{
                    left: `${ft.x}%`,
                    top: `${ft.y}%`,
                    transform: "translate(-50%, -50%)",
                    zIndex: isSelected ? 10 : 1,
                  }}
                >
                  <ShapedTable
                    table={ft}
                    seatedGuests={[]}
                    selected={isSelected}
                    onSelect={() =>
                      setSelectedTableId((prev) =>
                        prev === ft.id ? null : ft.id,
                      )
                    }
                    overlay="none"
                    sizePx={TABLE_SIZE}
                  />
                </div>
              );
            })}
          </FloorCanvas>

          <p className="mt-2 text-center text-[11px] text-muted-foreground/60">
            {selectedTable
              ? `Table ${selectedTable.tableNumber} selected — edit or remove in the panel`
              : "Click a table to select it · Use the panel to add, edit or remove tables"}
          </p>
        </div>

        {/* Right panel */}
        <div className="flex w-full shrink-0 flex-col gap-3 lg:w-72 xl:w-80">
          {/* Add table */}
          {canManage && (
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Add table
                </p>
              </div>
              <div className="p-3">
                <EntitySheet
                  trigger={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-full gap-1.5"
                    >
                      <Plus className="size-4" />
                      Add table
                    </Button>
                  }
                  title="Add table"
                  description={`Add a table to ${spaceName}`}
                  saveLabel="Add table"
                  onSave={handleAddTable}
                >
                  <TableForm
                    state={addState}
                    onChange={(patch) =>
                      setAddState((prev) => ({ ...prev, ...patch }))
                    }
                    formId={addFormId}
                  />
                </EntitySheet>
              </div>
            </div>
          )}

          {/* New template name (when no active saved template) */}
          {canManage && !activeTemplateId && (
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Template name
                </p>
              </div>
              <div className="p-3">
                <Input
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder={`${spaceName} — full layout`}
                  className="text-sm"
                />
              </div>
            </div>
          )}

          {/* Placed tables list */}
          <div className="flex-1 rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Placed tables
              </p>
              {activeTables.length > 0 && (
                <Badge
                  variant="secondary"
                  className="tabular-nums text-[10px]"
                >
                  {activeTables.length}
                </Badge>
              )}
            </div>

            {activeTables.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <Table2 className="size-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No tables yet</p>
                <p className="text-[11px] text-muted-foreground/70">
                  {canManage
                    ? "Load a template above or add tables one by one."
                    : "No tables configured for this template."}
                </p>
              </div>
            ) : (
              <ul
                role="listbox"
                aria-label="Placed tables"
                className="flex flex-col gap-0.5 p-2"
              >
                {activeTables.map((t) => (
                  <TableRow
                    key={t.id}
                    table={t}
                    isSelected={selectedTableId === t.id}
                    onSelect={() =>
                      setSelectedTableId((prev) =>
                        prev === t.id ? null : t.id,
                      )
                    }
                    onEdit={(patched) => handleEditTable(t.id, patched)}
                    onRemove={() => handleRemoveTable(t.id)}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* Selected table quick-info */}
          {selectedTable && (
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 shadow-sm">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary/70">
                  Selected
                </p>
                <button
                  onClick={() => setSelectedTableId(null)}
                  aria-label="Deselect table"
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <p className="text-base font-semibold text-foreground">
                Table {selectedTable.tableNumber}
              </p>
              {selectedTable.label && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {selectedTable.label}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium">
                  {SHAPE_LABELS[selectedTable.shape]}
                </span>
                <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium tabular-nums">
                  {selectedTable.capacity} seats
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
