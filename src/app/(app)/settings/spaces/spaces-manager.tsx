"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusCircle, Pencil, Trash2, AlertCircle, X, Check } from "lucide-react";
import { spaceSchema, type SpaceInput } from "@/lib/zod-schemas/settings-spaces";
import { createSpace, updateSpace, deleteSpace } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Database } from "@/lib/supabase/types";

type SpaceRow = Database["public"]["Tables"]["spaces"]["Row"];

// ---------------------------------------------------------------------------
// Space form (add or edit)
// ---------------------------------------------------------------------------

interface SpaceFormProps {
  defaultValues?: Partial<SpaceInput>;
  onSubmit: (values: SpaceInput) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

function SpaceForm({ defaultValues, onSubmit, onCancel, submitLabel }: SpaceFormProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SpaceInput>({
    resolver: zodResolver(spaceSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      capacity_seated: defaultValues?.capacity_seated ?? undefined,
      capacity_standing: defaultValues?.capacity_standing ?? undefined,
      description: defaultValues?.description ?? "",
    },
  });

  async function handleFormSubmit(values: SpaceInput) {
    setServerError(null);
    try {
      await onSubmit(values);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} noValidate className="space-y-4">
      {serverError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {/* Space name */}
      <div className="space-y-1.5">
        <Label htmlFor="space-name">Space name</Label>
        <Input
          id="space-name"
          type="text"
          placeholder="The Main Hall"
          aria-invalid={!!errors.name}
          disabled={isSubmitting}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Capacities */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="capacity-seated">Seated capacity</Label>
          <Input
            id="capacity-seated"
            type="number"
            min="0"
            placeholder="120"
            disabled={isSubmitting}
            {...register("capacity_seated", { valueAsNumber: true })}
          />
          {errors.capacity_seated && (
            <p className="text-xs text-destructive">{errors.capacity_seated.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="capacity-standing">Standing capacity</Label>
          <Input
            id="capacity-standing"
            type="number"
            min="0"
            placeholder="200"
            disabled={isSubmitting}
            {...register("capacity_standing", { valueAsNumber: true })}
          />
          {errors.capacity_standing && (
            <p className="text-xs text-destructive">{errors.capacity_standing.message}</p>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="space-desc">Description (optional)</Label>
        <Textarea
          id="space-desc"
          placeholder="A light-filled converted barn with original oak beams..."
          rows={3}
          disabled={isSubmitting}
          {...register("description")}
        />
        {errors.description && (
          <p className="text-xs text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <Button type="button" variant="ghost" disabled={isSubmitting} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="min-w-24">
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </span>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation inline
// ---------------------------------------------------------------------------

interface DeleteConfirmProps {
  spaceName: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

function DeleteConfirm({ spaceName, onConfirm, onCancel }: DeleteConfirmProps) {
  const [busy, setBusy] = React.useState(false);

  async function handleConfirm() {
    setBusy(true);
    await onConfirm();
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
      <span className="flex-1 text-foreground">
        Delete <span className="font-semibold">{spaceName}</span>? This cannot be undone.
      </span>
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={onCancel}
        className="shrink-0"
      >
        <X className="size-4" />
        <span className="sr-only">Cancel</span>
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={busy}
        onClick={handleConfirm}
        className="shrink-0"
      >
        <Check className="size-4 mr-1" />
        {busy ? "Deleting..." : "Confirm delete"}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single space row
// ---------------------------------------------------------------------------

interface SpaceCardProps {
  space: SpaceRow;
  canManage: boolean;
  onDeleted: (id: string) => void;
  onUpdated: (space: SpaceRow) => void;
}

function SpaceCard({ space, canManage, onDeleted, onUpdated }: SpaceCardProps) {
  const [mode, setMode] = React.useState<"view" | "edit" | "delete">("view");

  async function handleUpdate(values: SpaceInput) {
    const fd = new FormData();
    fd.set("name", values.name);
    if (values.capacity_seated != null) fd.set("capacity_seated", String(values.capacity_seated));
    if (values.capacity_standing != null) fd.set("capacity_standing", String(values.capacity_standing));
    if (values.description) fd.set("description", values.description);

    const result = await updateSpace(space.id, fd);
    if (!result.ok) throw new Error(result.error);
    toast.success("Space updated.");
    onUpdated(result.data);
    setMode("view");
  }

  async function handleDelete() {
    const result = await deleteSpace(space.id);
    if (!result.ok) {
      toast.error(result.error);
      setMode("view");
      return;
    }
    toast.success("Space deleted.");
    onDeleted(space.id);
  }

  const caps: string[] = [];
  if (space.capacity_seated != null) caps.push(`${space.capacity_seated} seated`);
  if (space.capacity_standing != null) caps.push(`${space.capacity_standing} standing`);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {mode === "edit" ? (
        <div className="p-6">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Edit space
          </p>
          <SpaceForm
            defaultValues={{
              name: space.name,
              capacity_seated: space.capacity_seated ?? undefined,
              capacity_standing: space.capacity_standing ?? undefined,
              description: space.description ?? undefined,
            }}
            onSubmit={handleUpdate}
            onCancel={() => setMode("view")}
            submitLabel="Save changes"
          />
        </div>
      ) : (
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">{space.name}</p>
              {caps.length > 0 && (
                <p className="mt-0.5 text-sm text-muted-foreground">{caps.join(" · ")}</p>
              )}
              {space.description && (
                <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
                  {space.description}
                </p>
              )}
            </div>
            {canManage && (
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setMode("edit")}
                  className="size-8 p-0"
                >
                  <Pencil className="size-4" />
                  <span className="sr-only">Edit</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setMode("delete")}
                  className="size-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                  <span className="sr-only">Delete</span>
                </Button>
              </div>
            )}
          </div>

          {mode === "delete" && (
            <div className="mt-4">
              <DeleteConfirm
                spaceName={space.name}
                onConfirm={handleDelete}
                onCancel={() => setMode("view")}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main manager component
// ---------------------------------------------------------------------------

interface SpacesManagerProps {
  initialSpaces: SpaceRow[];
  canManage: boolean;
}

export function SpacesManager({ initialSpaces, canManage }: SpacesManagerProps) {
  const [spaces, setSpaces] = React.useState<SpaceRow[]>(initialSpaces);
  const [showAddForm, setShowAddForm] = React.useState(false);

  function handleDeleted(id: string) {
    setSpaces((prev) => prev.filter((s) => s.id !== id));
  }

  function handleUpdated(updated: SpaceRow) {
    setSpaces((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function handleCreate(values: SpaceInput) {
    const fd = new FormData();
    fd.set("name", values.name);
    if (values.capacity_seated != null) fd.set("capacity_seated", String(values.capacity_seated));
    if (values.capacity_standing != null) fd.set("capacity_standing", String(values.capacity_standing));
    if (values.description) fd.set("description", values.description);

    const result = await createSpace(fd);
    if (!result.ok) throw new Error(result.error);
    toast.success("Space added.");
    setSpaces((prev) => [...prev, result.data]);
    setShowAddForm(false);
  }

  return (
    <div className="space-y-4">
      {/* Space list */}
      {spaces.length === 0 && !showAddForm && (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No spaces yet. Add your first one to get started.
          </p>
        </div>
      )}

      {spaces.map((space) => (
        <SpaceCard
          key={space.id}
          space={space}
          canManage={canManage}
          onDeleted={handleDeleted}
          onUpdated={handleUpdated}
        />
      ))}

      {/* Add form */}
      {showAddForm && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            New space
          </p>
          <SpaceForm
            onSubmit={handleCreate}
            onCancel={() => setShowAddForm(false)}
            submitLabel="Add space"
          />
        </div>
      )}

      {/* Add button */}
      {canManage && !showAddForm && (
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => setShowAddForm(true)}
        >
          <PlusCircle className="size-4" />
          Add space
        </Button>
      )}
    </div>
  );
}
