"use client";

/**
 * FloorConfigClient — admin floor/table template configurator.
 *
 * Lets a venue configure a saved table layout (template) for a space.
 * Opinionated presets (from FLOOR_TEMPLATES) can be loaded in one click;
 * individual tables can then be added, edited or removed. This is a TEMPLATE
 * the venue sets up once — not a per-wedding freeform builder.
 *
 * Interactions:
 *  - Preset strip: click a template pill to load it onto the canvas (optimistic)
 *  - Canvas: click a table to select it; selected table is highlighted + shown in the panel
 *  - Panel: list of placed tables with edit (EntitySheet) and remove
 *  - Add table: EntitySheet with shape / seats / label fields
 *  - Save: optimistic state + sonner toast (prototype — no backend)
 */

import { useState, useCallback, useId } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Pencil,
  LayoutTemplate,
  Check,
  Info,
  Table2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { EntitySheet } from "@/components/entity-sheet";
import { FloorCanvas } from "@/components/floorplan/floor-canvas";
import { ShapedTable } from "@/components/floorplan/shaped-table";
import type { Space, FloorTemplate } from "@/lib/mock/admin";
import type { FloorplanTable, RoomElement } from "@/lib/mock/planning";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TableShape = "round" | "banquet" | "square" | "top";

interface ConfigTable extends FloorplanTable {
  /** marks a table as pending removal (optimistic) */
  _removed?: boolean;
}

interface AddTableState {
  shape: TableShape;
  capacity: string;
  label: string;
}

interface EditTableState extends AddTableState {
  id: string;
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

// Canvas table size: large enough to see shape detail, not so big they overlap
// (matches the seeded floorplan's ~20% row pitch at the 640×480 min canvas).
const TABLE_SIZE = 96;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nextTableNumber(tables: ConfigTable[]): number {
  if (tables.length === 0) return 1;
  return Math.max(...tables.map((t) => t.tableNumber)) + 1;
}

/**
 * Compute a rough grid position for a newly placed table so it doesn't
 * land on top of an existing one. Returns x/y as percentages (0–100),
 * always within ~[8%, 92%] so added tables stay visible (the canvas is
 * overflow-hidden). Packs 6 columns × 4 rows, then wraps back to the top.
 */
function autoPosition(
  tables: ConfigTable[]
): { x: number; y: number } {
  const active = tables.filter((t) => !t._removed);
  const COLS = 6;
  const ROWS = 4;
  const X0 = 12;
  const X1 = 88;
  const Y0 = 14;
  const ROW_PITCH = 18;
  const slot = active.length % (COLS * ROWS);
  const col = slot % COLS;
  const row = Math.floor(slot / COLS);
  return {
    x: X0 + (col * (X1 - X0)) / (COLS - 1),
    y: Y0 + row * ROW_PITCH,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// ── Preset template pill ────────────────────────────────────────────────────

function PresetPill({
  template,
  isActive,
  onLoad,
}: {
  template: FloorTemplate;
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
          : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-accent/40 hover:shadow-sm"
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
            isActive ? "text-primary" : "text-muted-foreground"
          )}
        />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight truncate">{template.name}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
          {template.tableCount} tables · {template.capacity} cap.
          {template.isDefault && (
            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-primary/70">
              default
            </span>
          )}
        </p>
      </div>
    </button>
  );
}

// ── Shape selector ──────────────────────────────────────────────────────────

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
              : "border-border bg-card hover:bg-accent/40"
          )}
        >
          <span
            className={cn(
              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              value === s ? "border-primary bg-primary" : "border-border bg-transparent"
            )}
          >
            {value === s && <span className="size-2 rounded-full bg-white" />}
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">{SHAPE_LABELS[s]}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {SHAPE_DESCRIPTIONS[s]}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Add/Edit table form (rendered inside EntitySheet) ───────────────────────

function TableForm({
  state,
  onChange,
  formId,
}: {
  state: AddTableState;
  onChange: (patch: Partial<AddTableState>) => void;
  formId: string;
}) {
  return (
    <form id={formId} className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
      <div className="flex flex-col gap-2">
        <Label className="text-xs font-semibold">Table shape</Label>
        <ShapeSelector
          value={state.shape}
          onChange={(shape) =>
            onChange({
              shape,
              capacity: String(DEFAULT_CAPACITY[shape]),
            })
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
          Max seated guests at this table. Affects capacity calculations across packages.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${formId}-label`} className="text-xs font-semibold">
          Label <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id={`${formId}-label`}
          value={state.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="e.g. Head table, Family — Smith"
          maxLength={60}
        />
        <p className="text-[11px] text-muted-foreground">
          Shown as a hover tooltip on the canvas and in reports.
        </p>
      </div>
    </form>
  );
}

// ── Placed table row in the panel list ─────────────────────────────────────

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
  const [editState, setEditState] = useState<AddTableState>({
    shape: table.shape,
    capacity: String(table.capacity),
    label: table.label ?? "",
  });
  const formId = useId();

  // Reset the edit buffer when the underlying table changes (preset applied, or
  // the row reused for different table data) so the sheet never shows stale
  // values. Adjust-state-during-render pattern — no effect, no cascading render.
  const tableKey = `${table.id}|${table.shape}|${table.capacity}|${table.label ?? ""}`;
  const [prevTableKey, setPrevTableKey] = useState(tableKey);
  if (prevTableKey !== tableKey) {
    setPrevTableKey(tableKey);
    setEditState({
      shape: table.shape,
      capacity: String(table.capacity),
      label: table.label ?? "",
    });
  }

  return (
    <li
      className={cn(
        "group flex min-h-[44px] items-center gap-3 rounded-lg border px-3 py-2 transition-all duration-150 cursor-pointer",
        isSelected
          ? "border-primary/50 bg-primary/5 shadow-sm"
          : "border-transparent hover:border-border hover:bg-accent/30"
      )}
      onClick={onSelect}
      role="option"
      aria-selected={isSelected}
    >
      {/* Table number badge */}
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums transition-colors",
          isSelected
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {table.tableNumber}
      </span>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">
          {table.label ?? `Table ${table.tableNumber}`}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {SHAPE_LABELS[table.shape]} · {table.capacity} seats
        </p>
      </div>

      {/* Actions — visible on hover or selection */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-1 transition-opacity duration-100",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
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

// ── Empty canvas state ───────────────────────────────────────────────────────

function EmptyCanvasHint() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
      <Table2 className="size-8 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground/60 font-medium">No tables placed yet</p>
      <p className="text-[11px] text-muted-foreground/40">
        Load a preset or add tables from the panel
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export interface FloorConfigClientProps {
  space: Space;
  templates: FloorTemplate[];
  seedTables: FloorplanTable[];
  roomElements: RoomElement[];
}

export function FloorConfigClient({
  space,
  templates,
  seedTables,
  roomElements,
}: FloorConfigClientProps) {
  // ── State ──────────────────────────────────────────────────────────────────

  const [tables, setTables] = useState<ConfigTable[]>(
    seedTables as ConfigTable[]
  );
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(
    () => templates.find((t) => t.isDefault)?.id ?? templates[0]?.id ?? null
  );

  // Add table form state
  const [addState, setAddState] = useState<AddTableState>({
    shape: "round",
    capacity: "10",
    label: "",
  });
  const addFormId = useId();

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeTables = tables.filter((t) => !t._removed);
  const selectedTable = activeTables.find((t) => t.id === selectedTableId) ?? null;

  const totalCapacity = activeTables.reduce((sum, t) => sum + t.capacity, 0);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleTableClick = useCallback((t: ConfigTable) => {
    setSelectedTableId((prev) => (prev === t.id ? null : t.id));
  }, []);

  const handleLoadPreset = useCallback(
    (template: FloorTemplate) => {
      if (activeTemplateId === template.id) return;

      // For the prototype, loading a preset re-seeds the Long Barn layout
      // (only sp1 has real FLOORPLAN_TABLES data). Other spaces would fetch
      // from the API in production — here we show a toast and clear.
      if (space.id === "sp1") {
        setTables(seedTables as ConfigTable[]);
        toast.success(`Preset "${template.name}" loaded`, {
          description: `${template.tableCount} tables · ${template.capacity} total capacity`,
        });
      } else {
        setTables([]);
        toast(`Preset "${template.name}" loaded`, {
          description: "Adjust individual tables below to match your room.",
        });
      }
      setActiveTemplateId(template.id);
      setSelectedTableId(null);
    },
    [activeTemplateId, space.id, seedTables]
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
      id: `custom-${Date.now()}`,
      tableNumber,
      shape: addState.shape,
      capacity,
      x,
      y,
      label: addState.label.trim() || null,
    };
    setTables((prev) => [...prev, newTable]);
    setSelectedTableId(newTable.id);
    setActiveTemplateId(null); // custom arrangement — no preset active
    toast.success(`Table ${tableNumber} added`, {
      description: `${SHAPE_LABELS[addState.shape]} · ${capacity} seats`,
    });
    // Reset form
    setAddState({ shape: "round", capacity: "10", label: "" });
  }, [addState, tables]);

  const handleEditTable = useCallback(
    (id: string, patch: ConfigTable) => {
      setTables((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
      );
    },
    []
  );

  const handleRemoveTable = useCallback(
    (id: string) => {
      const t = tables.find((x) => x.id === id);
      setTables((prev) => prev.filter((x) => x.id !== id));
      if (selectedTableId === id) setSelectedTableId(null);
      setActiveTemplateId(null);
      toast(`Table ${t?.tableNumber ?? ""} removed`, {
        description: "Undo is not available in the prototype.",
      });
    },
    [tables, selectedTableId]
  );

  const handleSaveTemplate = useCallback(() => {
    toast.success("Template saved", {
      description: `${activeTables.length} tables · ${totalCapacity} total capacity`,
    });
  }, [activeTables.length, totalCapacity]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* ── Preset strip ── */}
      {templates.length > 0 && (
        <section aria-label="Layout presets">
          <div className="mb-2.5 flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Layout presets
            </p>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
              <Info className="size-3" aria-hidden />
              <span>Click to load a preset — then adjust individual tables</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {templates.map((tpl) => (
              <PresetPill
                key={tpl.id}
                template={tpl}
                isActive={activeTemplateId === tpl.id}
                onLoad={() => handleLoadPreset(tpl)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Main: canvas + panel ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

        {/* Canvas */}
        <div className="flex-1 min-w-0">
          {/* Capacity summary strip */}
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
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold tabular-nums text-foreground">
                {space.seatedCapacity}
              </span>
              <span className="text-muted-foreground">space capacity</span>
            </div>
            {totalCapacity > space.seatedCapacity && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <Badge variant="warning" className="text-[10px]">
                  Over capacity
                </Badge>
              </>
            )}
            <div className="ml-auto">
              <Button
                variant="default"
                size="sm"
                className="h-8"
                onClick={handleSaveTemplate}
              >
                Save template
              </Button>
            </div>
          </div>

          {/* Floor canvas */}
          <FloorCanvas roomElements={roomElements} className="shadow-sm">
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
                    onSelect={() => handleTableClick(ft)}
                    overlay="none"
                    sizePx={TABLE_SIZE}
                  />
                </div>
              );
            })}
          </FloorCanvas>

          {/* Canvas hint */}
          <p className="mt-2 text-center text-[11px] text-muted-foreground/60">
            {selectedTable
              ? `Table ${selectedTable.tableNumber} selected — edit or remove in the panel`
              : "Click a table to select it · Use the panel to add, edit or remove tables"}
          </p>
        </div>

        {/* Right panel */}
        <div className="w-full lg:w-72 xl:w-80 shrink-0 flex flex-col gap-3">

          {/* Add table */}
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Add table
              </p>
            </div>
            <div className="p-3">
              <EntitySheet
                trigger={
                  <Button variant="outline" size="sm" className="w-full h-9 gap-1.5">
                    <Plus className="size-4" />
                    Add table
                  </Button>
                }
                title="Add table"
                description={`Add a table to ${space.name}`}
                saveLabel="Add table"
                onSave={handleAddTable}
              >
                <TableForm
                  state={addState}
                  onChange={(patch) => setAddState((prev) => ({ ...prev, ...patch }))}
                  formId={addFormId}
                />
              </EntitySheet>
            </div>
          </div>

          {/* Placed tables list */}
          <div className="rounded-xl border border-border bg-card shadow-sm flex-1">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Placed tables
              </p>
              {activeTables.length > 0 && (
                <Badge variant="secondary" className="tabular-nums text-[10px]">
                  {activeTables.length}
                </Badge>
              )}
            </div>

            {activeTables.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
                <Table2 className="size-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No tables yet</p>
                <p className="text-[11px] text-muted-foreground/70">
                  Load a preset above or add tables one by one.
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
                    onSelect={() => handleTableClick(t)}
                    onEdit={(patched) => handleEditTable(t.id, patched)}
                    onRemove={() => handleRemoveTable(t.id)}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* Selected table quick-info */}
          {selectedTable && (
            <div className="rounded-xl border border-primary/40 bg-primary/5 shadow-sm p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
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
                <p className="text-sm text-muted-foreground mt-0.5">
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
