"use client"

import * as React from "react"
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
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { CUSTOM_FIELDS } from "@/lib/mock/admin"
import type { CustomField } from "@/lib/mock/admin"
import { EntitySheet } from "@/components/entity-sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIELD_CAP = 12

const FIELD_TYPE_META: Record<
  CustomField["type"],
  { label: string; Icon: React.ElementType; badgeVariant: "outline" | "default" | "teal" | "blue" | "pink" }
> = {
  text:   { label: "Text",   Icon: Type,        badgeVariant: "outline" },
  number: { label: "Number", Icon: Hash,         badgeVariant: "blue" },
  select: { label: "Select", Icon: ListChecks,   badgeVariant: "teal" },
  date:   { label: "Date",   Icon: CalendarDays, badgeVariant: "pink" },
}

const APPEARS_ON_LABELS: Record<CustomField["appliesTo"], string> = {
  contact: "Enquiry form & contact",
  wedding: "Wedding record",
}

// ---------------------------------------------------------------------------
// Form state for create / edit
// ---------------------------------------------------------------------------

interface FieldFormState {
  label: string
  type: CustomField["type"]
  options: string   // comma-separated raw input
  appliesTo: CustomField["appliesTo"]
}

const BLANK_FORM: FieldFormState = {
  label: "",
  type: "text",
  options: "",
  appliesTo: "contact",
}

function deriveOptions(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// FieldForm — the content rendered inside EntitySheet
// ---------------------------------------------------------------------------

interface FieldFormProps {
  form: FieldFormState
  onChange: (patch: Partial<FieldFormState>) => void
}

function FieldForm({ form, onChange }: FieldFormProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Label */}
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

      {/* Type */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cf-type">Field type</Label>
        <Select
          value={form.type}
          onValueChange={(v) => onChange({ type: v as CustomField["type"] })}
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

      {/* Options — only when type is select */}
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
            Comma-separated list. Keep it short — couples see these as a dropdown.
          </p>
          {form.options && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {deriveOptions(form.options).map((opt) => (
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

      {/* Appears on */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cf-appears-on">Where it appears</Label>
        <Select
          value={form.appliesTo}
          onValueChange={(v) =>
            onChange({ appliesTo: v as CustomField["appliesTo"] })
          }
        >
          <SelectTrigger id="cf-appears-on" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="contact">Enquiry form &amp; contact record</SelectItem>
            <SelectItem value="wedding">Wedding record only</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          &ldquo;Enquiry form &amp; contact&rdquo; fields appear on your public form and in every couple&apos;s contact record.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

interface FieldRowProps {
  field: CustomField
  isArchived: boolean
  onEdit: (field: CustomField) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
}

function FieldRow({ field, isArchived, onEdit, onArchive, onRestore }: FieldRowProps) {
  const meta = FIELD_TYPE_META[field.type]
  const Icon = meta.Icon

  return (
    <div
      className={cn(
        "group flex min-h-[56px] items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-all",
        isArchived ? "opacity-50" : "hover:-translate-y-px hover:shadow-sm",
      )}
    >
      {/* Drag handle — decorative in prototype */}
      <GripVertical
        className="size-4 shrink-0 text-muted-foreground/40 cursor-grab"
        aria-hidden
      />

      {/* Type icon */}
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted"
        aria-hidden
      >
        <Icon className="size-4 text-muted-foreground" />
      </span>

      {/* Label + meta */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {field.label}
          {isArchived && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">(archived)</span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {APPEARS_ON_LABELS[field.appliesTo]}
          {field.options && field.options.length > 0 && (
            <> &middot; {field.options.length} option{field.options.length !== 1 ? "s" : ""}</>
          )}
        </p>
      </div>

      {/* Type badge */}
      <Badge variant={meta.badgeVariant} className="shrink-0 gap-1 tabular-nums">
        <Icon className="size-3" aria-hidden />
        {meta.label}
      </Badge>

      {/* Actions */}
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
              onClick={() => onRestore(field.id)}
              className="gap-2"
            >
              <Archive className="size-4" />
              Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => onArchive(field.id)}
              className="gap-2 text-muted-foreground"
            >
              <Archive className="size-4" />
              Archive
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Edit sheet wrapper — controls form state for editing a specific field
// ---------------------------------------------------------------------------

interface EditSheetProps {
  field: CustomField
  onSave: (id: string, patch: Partial<CustomField>) => void
}

function EditSheet({ field, onSave }: EditSheetProps) {
  const initForm = (): FieldFormState => ({
    label: field.label,
    type: field.type,
    options: field.options?.join(", ") ?? "",
    appliesTo: field.appliesTo,
  })
  const [form, setForm] = React.useState<FieldFormState>(initForm)

  // Re-init when a different field is passed in (adjust-during-render pattern,
  // not an effect — avoids cascading-render lint).
  const [prevFieldId, setPrevFieldId] = React.useState(field.id)
  if (field.id !== prevFieldId) {
    setPrevFieldId(field.id)
    setForm(initForm())
  }

  function handleSave() {
    if (!form.label.trim()) {
      toast.error("Field label is required")
      return
    }
    onSave(field.id, {
      label: form.label.trim(),
      type: form.type,
      options: form.type === "select" ? deriveOptions(form.options) : undefined,
      appliesTo: form.appliesTo,
    })
  }

  return (
    <EntitySheet
      trigger={<span />}
      title={`Edit: ${field.label}`}
      description="Changes take effect immediately across all records."
      saveLabel="Save changes"
      onSave={handleSave}
    >
      <FieldForm
        form={form}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
      />
    </EntitySheet>
  )
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function CustomFieldsClient() {
  const [fields, setFields] = React.useState<CustomField[]>(CUSTOM_FIELDS)
  const [archivedIds, setArchivedIds] = React.useState<Set<string>>(new Set())
  const [showArchived, setShowArchived] = React.useState(false)

  // Add-new sheet state
  const [addOpen, setAddOpen] = React.useState(false)
  const [addForm, setAddForm] = React.useState<FieldFormState>(BLANK_FORM)

  // Edit sheet — track which field is being edited
  const [editingField, setEditingField] = React.useState<CustomField | null>(null)
  const [editSheetOpen, setEditSheetOpen] = React.useState(false)

  const activeFields = fields.filter((f) => !archivedIds.has(f.id))
  const archivedFields = fields.filter((f) => archivedIds.has(f.id))
  const atCap = activeFields.length >= FIELD_CAP

  function handleArchive(id: string) {
    setArchivedIds((prev) => new Set([...prev, id]))
    toast("Field archived — it won't appear on new records.")
  }

  function handleRestore(id: string) {
    setArchivedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    toast("Field restored.")
  }

  function handleAddSave() {
    if (!addForm.label.trim()) {
      toast.error("Field label is required")
      return
    }
    const newField: CustomField = {
      id: `cf${Date.now()}`,
      key: addForm.label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
      label: addForm.label.trim(),
      type: addForm.type,
      options: addForm.type === "select" ? deriveOptions(addForm.options) : undefined,
      appliesTo: addForm.appliesTo,
      order: fields.length + 1,
    }
    setFields((prev) => [...prev, newField])
    setAddForm(BLANK_FORM)
    setAddOpen(false)
    toast.success(`"${newField.label}" added`)
  }

  function handleEditSave(id: string, patch: Partial<CustomField>) {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f))
    )
    setEditSheetOpen(false)
    toast.success("Field updated")
  }

  function openEdit(field: CustomField) {
    setEditingField(field)
    setEditSheetOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ------------------------------------------------------------------ */}
      {/* Cap notice                                                           */}
      {/* ------------------------------------------------------------------ */}
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
        {/* Usage bar */}
        <div
          className="hidden sm:flex shrink-0 flex-col items-end gap-1 text-xs tabular-nums text-muted-foreground"
          aria-label={`${activeFields.length} of ${FIELD_CAP} custom fields used`}
        >
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                atCap ? "bg-warning-foreground" : "bg-primary"
              )}
              style={{ width: `${Math.min((activeFields.length / FIELD_CAP) * 100, 100)}%` }}
            />
          </div>
          <span>
            {activeFields.length} / {FIELD_CAP}
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Toolbar: filter chips + add button                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Appears-on filter chips — visual grouping hint */}
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Show
          </span>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              "min-h-[32px]",
              showArchived
                ? "bg-muted text-foreground"
                : "bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Archive className="size-3.5" />
            Archived ({archivedFields.length})
          </button>
        </div>

        {/* Add new — disabled at cap */}
        <EntitySheet
          trigger={
            <Button
              variant="default"
              size="sm"
              disabled={atCap}
              aria-label="Add custom field"
            >
              <Plus className="size-4" />
              Add field
            </Button>
          }
          title="Add custom field"
          description={`Define a field that will appear on ${addForm.appliesTo === "contact" ? "your enquiry form and contact records" : "wedding records"}.`}
          saveLabel="Add field"
          onSave={handleAddSave}
        >
          <FieldForm
            form={addForm}
            onChange={(patch) => setAddForm((prev) => ({ ...prev, ...patch }))}
          />
        </EntitySheet>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Active fields list                                                   */}
      {/* ------------------------------------------------------------------ */}
      <section aria-label="Active custom fields">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Active — {activeFields.length}
        </p>

        {activeFields.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <ListChecks className="mb-3 size-8 text-muted-foreground/50" aria-hidden />
            <p className="text-sm font-medium text-foreground">No custom fields yet</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Add your first field to capture venue-specific information on enquiries — like preferred space or how couples found you.
            </p>
            <EntitySheet
              trigger={
                <Button variant="default" size="sm" className="mt-4">
                  <Plus className="size-4" />
                  Add first field
                </Button>
              }
              title="Add custom field"
              saveLabel="Add field"
              onSave={handleAddSave}
            >
              <FieldForm
                form={addForm}
                onChange={(patch) => setAddForm((prev) => ({ ...prev, ...patch }))}
              />
            </EntitySheet>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {activeFields.map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                isArchived={false}
                onEdit={openEdit}
                onArchive={handleArchive}
                onRestore={handleRestore}
              />
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Archived fields (collapsible)                                        */}
      {/* ------------------------------------------------------------------ */}
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
                  isArchived
                  onEdit={openEdit}
                  onArchive={handleArchive}
                  onRestore={handleRestore}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Edit sheet — portal-rendered, controlled by editSheetOpen state     */}
      {/* ------------------------------------------------------------------ */}
      {editingField && editSheetOpen && (
        <EditSheetController
          field={editingField}
          onSave={handleEditSave}
          onClose={() => setEditSheetOpen(false)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// EditSheetController — mounts a controlled Sheet outside FieldRow so the
// trigger pattern is inverted: the parent opens it imperatively.
// ---------------------------------------------------------------------------

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet"

interface EditSheetControllerProps {
  field: CustomField
  onSave: (id: string, patch: Partial<CustomField>) => void
  onClose: () => void
}

function EditSheetController({ field, onSave, onClose }: EditSheetControllerProps) {
  const [form, setForm] = React.useState<FieldFormState>({
    label: field.label,
    type: field.type,
    options: field.options?.join(", ") ?? "",
    appliesTo: field.appliesTo,
  })

  function handleSave() {
    if (!form.label.trim()) {
      toast.error("Field label is required")
      return
    }
    onSave(field.id, {
      label: form.label.trim(),
      type: form.type,
      options: form.type === "select" ? deriveOptions(form.options) : undefined,
      appliesTo: form.appliesTo,
    })
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 sm:max-w-md"
      >
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
          <Button variant="default" size="default" onClick={handleSave}>
            Save changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
