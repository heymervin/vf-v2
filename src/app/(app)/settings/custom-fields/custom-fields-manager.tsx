"use client";

import * as React from "react";
import {
  Plus,
  MoreHorizontal,
  Archive,
  Pencil,
  Hash,
  Type,
  CalendarDays,
  ListChecks,
  GripVertical,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { EntitySheet } from "@/components/entity-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import {
  createCustomField,
  updateCustomField,
  setCustomFieldArchived,
} from "./actions";
import { FIELD_CAP } from "./constants";
import type { CustomFieldRow } from "./actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FieldType = "text" | "number" | "select" | "date";
type AppliesTo = "contact" | "wedding";

interface FieldFormState {
  label: string;
  type: FieldType;
  options: string; // comma-separated raw input
  applies_to: AppliesTo;
}

const BLANK_FORM: FieldFormState = {
  label: "",
  type: "text",
  options: "",
  applies_to: "contact",
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIELD_TYPE_META: Record<
  FieldType,
  {
    label: string;
    Icon: React.ElementType;
    badgeVariant: "outline" | "default" | "teal" | "blue" | "pink";
  }
> = {
  text: { label: "Text", Icon: Type, badgeVariant: "outline" },
  number: { label: "Number", Icon: Hash, badgeVariant: "blue" },
  select: { label: "Select", Icon: ListChecks, badgeVariant: "teal" },
  date: { label: "Date", Icon: CalendarDays, badgeVariant: "pink" },
};

const APPEARS_ON_LABELS: Record<AppliesTo, string> = {
  contact: "Enquiry form & contact",
  wedding: "Wedding record",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveOptionsArray(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// FieldForm — shared form content for add/edit sheets
// ---------------------------------------------------------------------------

interface FieldFormProps {
  form: FieldFormState;
  onChange: (patch: Partial<FieldFormState>) => void;
}

function FieldForm({ form, onChange }: FieldFormProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cf-label">Field label</Label>
        <Input
          id="cf-label"
          value={form.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="e.g. How did you hear about us?"
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          This is the label couples and your team will see.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cf-type">Field type</Label>
        <Select
          value={form.type}
          onValueChange={(v) => onChange({ type: v as FieldType })}
        >
          <SelectTrigger id="cf-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text — free-form answer</SelectItem>
            <SelectItem value="number">Number — e.g. guest count</SelectItem>
            <SelectItem value="select">Select — pick from a list</SelectItem>
            <SelectItem value="date">Date — date picker</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {form.type === "select" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cf-options">Options</Label>
          <Input
            id="cf-options"
            value={form.options}
            onChange={(e) => onChange({ options: e.target.value })}
            placeholder="Instagram, Google, Hitched, Referral"
          />
          <p className="text-xs text-muted-foreground">
            Comma-separated list. Keep it short — couples see these as a
            dropdown.
          </p>
          {form.options && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {deriveOptionsArray(form.options).map((opt) => (
                <span
                  key={opt}
                  className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground"
                >
                  {opt}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cf-appears-on">Where it appears</Label>
        <Select
          value={form.applies_to}
          onValueChange={(v) => onChange({ applies_to: v as AppliesTo })}
        >
          <SelectTrigger id="cf-appears-on" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contact">
              Enquiry form &amp; contact record
            </SelectItem>
            <SelectItem value="wedding">Wedding record only</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          &ldquo;Enquiry form &amp; contact&rdquo; fields appear on your public
          form and in every couple&apos;s contact record.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FieldRow
// ---------------------------------------------------------------------------

interface FieldRowProps {
  field: CustomFieldRow;
  onEdit: (field: CustomFieldRow) => void;
  onArchive: (id: string, archive: boolean) => void;
}

function FieldRow({ field, onEdit, onArchive }: FieldRowProps) {
  const type = field.type as FieldType;
  const meta = FIELD_TYPE_META[type] ?? FIELD_TYPE_META.text;
  const Icon = meta.Icon;
  const isArchived = field.is_archived;

  return (
    <div
      className={cn(
        "group flex min-h-[56px] items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-all",
        isArchived ? "opacity-50" : "hover:-translate-y-px hover:shadow-sm",
      )}
    >
      <GripVertical
        className="size-4 shrink-0 text-muted-foreground/40 cursor-grab"
        aria-hidden
      />

      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted"
        aria-hidden
      >
        <Icon className="size-4 text-muted-foreground" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {field.label}
          {isArchived && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              (archived)
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {APPEARS_ON_LABELS[field.applies_to as AppliesTo] ?? field.applies_to}
          {field.options && field.options.length > 0 && (
            <>
              {" "}
              &middot; {field.options.length} option
              {field.options.length !== 1 ? "s" : ""}
            </>
          )}
        </p>
      </div>

      <Badge variant={meta.badgeVariant} className="shrink-0 gap-1 tabular-nums">
        <Icon className="size-3" aria-hidden />
        {meta.label}
      </Badge>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100"
            aria-label={`Actions for ${field.label}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {!isArchived && (
            <DropdownMenuItem
              onClick={() => onEdit(field)}
              className="gap-2"
            >
              <Pencil className="size-4" />
              Edit field
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {isArchived ? (
            <DropdownMenuItem
              onClick={() => onArchive(field.id, false)}
              className="gap-2"
            >
              <Archive className="size-4" />
              Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => onArchive(field.id, true)}
              className="gap-2 text-muted-foreground"
            >
              <Archive className="size-4" />
              Archive
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditSheetController — imperatively opened sheet for editing a specific field
// ---------------------------------------------------------------------------

interface EditSheetControllerProps {
  field: CustomFieldRow;
  onClose: () => void;
  onSaved: () => void;
}

function EditSheetController({
  field,
  onClose,
  onSaved,
}: EditSheetControllerProps) {
  const [form, setForm] = React.useState<FieldFormState>({
    label: field.label,
    type: field.type as FieldType,
    options: field.options?.join(", ") ?? "",
    applies_to: field.applies_to as AppliesTo,
  });
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    if (!form.label.trim()) {
      toast.error("Field label is required");
      return;
    }
    setSaving(true);
    const result = await updateCustomField({
      id: field.id,
      label: form.label.trim(),
      type: form.type,
      options: form.type === "select" ? deriveOptionsArray(form.options) : [],
      applies_to: form.applies_to,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Field updated");
    onSaved();
    onClose();
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="text-base font-semibold text-foreground">
            Edit field
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Changes take effect immediately across all records.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <FieldForm
            form={form}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          />
        </div>

        <SheetFooter className="border-t border-border px-6 py-4 flex-row items-center justify-end gap-2">
          <SheetClose asChild>
            <Button variant="ghost" size="default">
              Cancel
            </Button>
          </SheetClose>
          <Button
            variant="default"
            size="default"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// CustomFieldsManager — main client component
// ---------------------------------------------------------------------------

interface CustomFieldsManagerProps {
  initialFields: CustomFieldRow[];
  canManage: boolean;
}

export function CustomFieldsManager({
  initialFields,
  canManage,
}: CustomFieldsManagerProps) {
  const router = useRouter();
  const [fields, setFields] = React.useState<CustomFieldRow[]>(initialFields);
  const [showArchived, setShowArchived] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [addForm, setAddForm] = React.useState<FieldFormState>(BLANK_FORM);
  const [addSaving, setAddSaving] = React.useState(false);
  const [editingField, setEditingField] = React.useState<CustomFieldRow | null>(null);

  const activeFields = fields.filter((f) => !f.is_archived);
  const archivedFields = fields.filter((f) => f.is_archived);
  const atCap = activeFields.length >= FIELD_CAP;

  function refresh() {
    router.refresh();
  }

  // ---------- Add new field ----------

  async function handleAddSave() {
    if (!addForm.label.trim()) {
      toast.error("Field label is required");
      return;
    }
    setAddSaving(true);
    const result = await createCustomField({
      label: addForm.label.trim(),
      type: addForm.type,
      options: addForm.type === "select" ? deriveOptionsArray(addForm.options) : [],
      applies_to: addForm.applies_to,
    });
    setAddSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setFields((prev) => [...prev, result.data]);
    setAddForm(BLANK_FORM);
    setAddOpen(false);
    toast.success(`"${result.data.label}" added`);
    refresh();
  }

  // ---------- Archive / restore ----------

  async function handleArchive(id: string, archive: boolean) {
    const field = fields.find((f) => f.id === id);
    const result = await setCustomFieldArchived({ id, is_archived: archive });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, is_archived: archive } : f)),
    );
    if (archive) {
      toast(`"${field?.label ?? "Field"}" archived — it won't appear on new records.`);
    } else {
      toast.success(`"${field?.label ?? "Field"}" restored.`);
    }
    refresh();
  }

  // ---------- Edit ----------

  function openEdit(field: CustomFieldRow) {
    setEditingField(field);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cap notice */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3.5">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground">
            <span className="font-medium">Capped at {FIELD_CAP} custom fields.</span>{" "}
            VenueFlow&apos;s data model is intentionally fixed — these fields are the
            bounded escape-hatch for venue-specific context that doesn&apos;t fit the
            standard enquiry schema.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeFields.length} of {FIELD_CAP} used
            {atCap && " — archive a field before adding a new one"}
          </p>
        </div>
        <div
          className="hidden sm:flex shrink-0 flex-col items-end gap-1 text-xs tabular-nums text-muted-foreground"
          aria-label={`${activeFields.length} of ${FIELD_CAP} custom fields used`}
        >
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                atCap ? "bg-warning-foreground" : "bg-primary",
              )}
              style={{
                width: `${Math.min((activeFields.length / FIELD_CAP) * 100, 100)}%`,
              }}
            />
          </div>
          <span>
            {activeFields.length} / {FIELD_CAP}
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Show
          </span>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors min-h-[32px]",
              showArchived
                ? "bg-muted text-foreground"
                : "bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Archive className="size-3.5" />
            Archived ({archivedFields.length})
          </button>
        </div>

        {canManage && (
          <Sheet open={addOpen} onOpenChange={setAddOpen}>
            <span
              className="inline-flex cursor-pointer"
              role="presentation"
              onClick={() => !atCap && setAddOpen(true)}
            >
              <Button
                variant="default"
                size="sm"
                disabled={atCap}
                aria-label="Add custom field"
              >
                <Plus className="size-4" />
                Add field
              </Button>
            </span>
            <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-md">
              <SheetHeader className="border-b border-border px-6 py-5">
                <SheetTitle className="text-base font-semibold text-foreground">
                  Add custom field
                </SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  Define a field that will appear on{" "}
                  {addForm.applies_to === "contact"
                    ? "your enquiry form and contact records"
                    : "wedding records"}
                  .
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <FieldForm
                  form={addForm}
                  onChange={(patch) =>
                    setAddForm((prev) => ({ ...prev, ...patch }))
                  }
                />
              </div>
              <SheetFooter className="border-t border-border px-6 py-4 flex-row items-center justify-end gap-2">
                <SheetClose asChild>
                  <Button variant="ghost" size="default">
                    Cancel
                  </Button>
                </SheetClose>
                <Button
                  variant="default"
                  size="default"
                  onClick={handleAddSave}
                  disabled={addSaving}
                >
                  {addSaving ? "Adding…" : "Add field"}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Active fields */}
      <section aria-label="Active custom fields">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Active — {activeFields.length}
        </p>

        {activeFields.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <ListChecks className="mb-3 size-8 text-muted-foreground/50" aria-hidden />
            <p className="text-sm font-medium text-foreground">
              No custom fields yet
            </p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Add your first field to capture venue-specific information on
              enquiries — like preferred space or how couples found you.
            </p>
            {canManage && (
              <Button
                variant="default"
                size="sm"
                className="mt-4"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="size-4" />
                Add first field
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {activeFields.map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                onEdit={canManage ? openEdit : () => undefined}
                onArchive={canManage ? handleArchive : () => undefined}
              />
            ))}
          </div>
        )}
      </section>

      {/* Archived fields */}
      {showArchived && (
        <section aria-label="Archived custom fields">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Archived — {archivedFields.length}
          </p>
          {archivedFields.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No archived fields.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {archivedFields.map((field) => (
                <FieldRow
                  key={field.id}
                  field={field}
                  onEdit={() => undefined}
                  onArchive={canManage ? handleArchive : () => undefined}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Edit sheet — controlled externally by editingField state */}
      {editingField && (
        <EditSheetController
          field={editingField}
          onClose={() => setEditingField(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
