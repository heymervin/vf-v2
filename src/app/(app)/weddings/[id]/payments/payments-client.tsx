"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Send,
  RefreshCw,
  ExternalLink,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  upsertMilestone,
  deleteMilestone,
  updateMilestoneStatus,
  sendGhlInvoice,
  refreshGhlInvoiceStatus,
} from "./actions";
import type { MilestoneWithStatus, UpsertMilestoneInput } from "./actions";

// ── Pure helpers (no "use server") ─────────────────────────────────────────────

function minorToPounds(minor: number): string {
  return (minor / 100).toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Status badge ──────────────────────────────────────────────────────────────

/** Per-milestone lifecycle status — matches the DB CHECK constraint exactly. */
type LifecycleStatus = "upcoming" | "due" | "paid" | "overdue";

const STATUS_LABELS: Record<LifecycleStatus, string> = {
  upcoming: "Upcoming",
  due: "Due",
  paid: "Paid",
  overdue: "Overdue",
};

const STATUS_VARIANTS: Record<LifecycleStatus, "outline" | "secondary" | "warning" | "success"> = {
  upcoming: "outline",
  due: "warning",
  paid: "success",
  overdue: "warning",
};

function StatusBadge({ status }: { status: string }) {
  const s = status as LifecycleStatus;
  return (
    <Badge variant={STATUS_VARIANTS[s] ?? "outline"} className="whitespace-nowrap text-[11px]">
      {STATUS_LABELS[s] ?? status}
    </Badge>
  );
}

// ── Milestone form dialog ─────────────────────────────────────────────────────

interface MilestoneFormProps {
  open: boolean;
  onClose: () => void;
  weddingId: string;
  editing?: MilestoneWithStatus;
}

const STATUS_OPTIONS: { value: UpsertMilestoneInput["status"]; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "due", label: "Due" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

function MilestoneFormDialog({ open, onClose, weddingId, editing }: MilestoneFormProps) {
  const [label, setLabel] = useState(editing?.label ?? "");
  const [amountPounds, setAmountPounds] = useState(
    editing ? (editing.amount_minor / 100).toFixed(2) : ""
  );
  const [dueDate, setDueDate] = useState(editing?.due_date ?? "");
  const [status, setStatus] = useState<UpsertMilestoneInput["status"]>(
    (editing?.status as UpsertMilestoneInput["status"]) ?? "upcoming"
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await upsertMilestone({
        id: editing?.id,
        weddingId,
        label,
        amountPounds,
        dueDate,
        status,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(editing ? "Milestone updated" : "Milestone added");
      onClose();
      // Re-fetch the server data so the new/edited milestone appears in the list
      // (the parent syncs its state from the refreshed initialMilestones prop).
      router.refresh();
    });
  }

  // Reset form state when dialog opens for a new milestone
  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit milestone" : "Add payment milestone"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="pm-label">Label</Label>
              <Input
                id="pm-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Deposit, Final balance"
                required
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pm-amount">Amount (£)</Label>
              <Input
                id="pm-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amountPounds}
                onChange={(e) => setAmountPounds(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pm-due">Due date</Label>
              <Input
                id="pm-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pm-status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as UpsertMilestoneInput["status"])}
              >
                <SelectTrigger id="pm-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : editing ? "Save changes" : "Add milestone"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── GHL connect prompt ─────────────────────────────────────────────────────────

function GhlConnectPrompt() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-4">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">VenueFlow not connected</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Connect your VenueFlow account in{" "}
          <a href="/settings/ghl" className="text-primary underline underline-offset-2">
            Settings &rarr; VenueFlow
          </a>{" "}
          to send invoices directly from VenueFlow.
        </p>
      </div>
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

interface Props {
  weddingId: string;
  /** GHL contact id from weddings.ghl_contact_id — null when no GHL */
  ghlContactId: string | null;
  initialMilestones: MilestoneWithStatus[];
  hasGhlConnection: boolean;
}

export function PaymentsClient({
  weddingId,
  ghlContactId,
  initialMilestones,
  hasGhlConnection,
}: Props) {
  const [milestones, setMilestones] = useState<MilestoneWithStatus[]>(initialMilestones);
  // Render-time prop-sync: when the server re-renders after a mutation
  // (router.refresh), reflect the fresh list. Avoids set-state-in-effect.
  const [prevInitial, setPrevInitial] = useState(initialMilestones);
  if (prevInitial !== initialMilestones) {
    setPrevInitial(initialMilestones);
    setMilestones(initialMilestones);
  }
  const [formOpen, setFormOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<MilestoneWithStatus | undefined>();
  const [, startTransition] = useTransition();

  // ── Computed totals ──────────────────────────────────────────────────────────
  const totalMinor = milestones.reduce((sum, m) => sum + m.amount_minor, 0);
  const paidMinor = milestones
    .filter((m) => m.status === "paid")
    .reduce((sum, m) => sum + m.amount_minor, 0);
  const balanceMinor = totalMinor - paidMinor;

  // ── Handlers ────────────────────────────────────────────────────────────────

  function openAdd() {
    setEditingMilestone(undefined);
    setFormOpen(true);
  }

  function openEdit(m: MilestoneWithStatus) {
    setEditingMilestone(m);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingMilestone(undefined);
  }

  function handleDelete(milestoneId: string) {
    startTransition(async () => {
      const result = await deleteMilestone({ milestoneId, weddingId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setMilestones((prev) => prev.filter((m) => m.id !== milestoneId));
      toast.success("Milestone deleted");
    });
  }

  function handleStatusChange(milestoneId: string, status: string) {
    startTransition(async () => {
      const result = await updateMilestoneStatus({ milestoneId, weddingId, status });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setMilestones((prev) =>
        prev.map((m) => (m.id === milestoneId ? { ...m, status } : m))
      );
    });
  }

  function handleSendInvoice(m: MilestoneWithStatus) {
    if (!ghlContactId) {
      toast.error("This wedding has no linked contact.");
      return;
    }
    startTransition(async () => {
      const result = await sendGhlInvoice({
        milestoneId: m.id,
        weddingId,
        ghlContactId,
        invoiceName: m.label,
        amountMinor: m.amount_minor,
        dueDate: m.due_date,
      });
      if (!result.ok) {
        if (result.error === "no-ghl-connection") {
          toast.error("No connection. Connect in Settings → VenueFlow.");
        } else {
          toast.error(result.error);
        }
        return;
      }
      setMilestones((prev) =>
        prev.map((item) =>
          item.id === m.id
            ? {
                ...item,
                ghl_invoice_id: result.data.ghlInvoiceId,
                status: result.data.displayStatus,
                displayStatus: result.data.displayStatus,
              }
            : item
        )
      );
      toast.success("Invoice sent");
    });
  }

  function handleRefreshStatus(m: MilestoneWithStatus) {
    if (!m.ghl_invoice_id) return;
    startTransition(async () => {
      const result = await refreshGhlInvoiceStatus({
        milestoneId: m.id,
        weddingId,
        ghlInvoiceId: m.ghl_invoice_id!,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setMilestones((prev) =>
        prev.map((item) =>
          item.id === m.id
            ? { ...item, status: result.data, displayStatus: result.data }
            : item
        )
      );
      toast.success("Status refreshed");
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Summary strip ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-px rounded-xl border border-border bg-border">
        <div className="flex flex-col gap-0.5 rounded-l-xl bg-card px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Total
          </span>
          <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
            {minorToPounds(totalMinor)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 bg-card px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Received
          </span>
          <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
            {minorToPounds(paidMinor)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-r-xl bg-card px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Balance
          </span>
          <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
            {minorToPounds(balanceMinor)}
          </span>
        </div>
      </div>

      {/* ── GHL connect prompt ────────────────────────────────────────────── */}
      {!hasGhlConnection && <GhlConnectPrompt />}

      {/* ── Milestones list ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="size-4 text-fun-teal-strong" aria-hidden />
              Payment milestones
            </CardTitle>
            <Button size="sm" onClick={openAdd}>
              <Plus className="size-3.5" aria-hidden />
              Add milestone
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {milestones.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <CreditCard className="size-8 text-muted-foreground/40" aria-hidden />
              <p className="text-sm text-muted-foreground">No milestones yet.</p>
              <Button variant="outline" size="sm" onClick={openAdd}>
                <Plus className="size-3.5" aria-hidden />
                Add first milestone
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {milestones.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  {/* Left: label + date */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{m.label}</p>
                    <p className="text-xs text-muted-foreground">
                      Due {formatDate(m.due_date)}
                      {m.ghl_invoice_id && (
                        <span className="ml-2 text-primary">· Invoice linked</span>
                      )}
                    </p>
                  </div>

                  {/* Centre: amount + status */}
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {minorToPounds(m.amount_minor)}
                    </span>
                    <StatusBadge status={m.status} />
                  </div>

                  {/* Right: actions */}
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {/* Status quick-select */}
                    <Select
                      value={m.status}
                      onValueChange={(v) => handleStatusChange(m.id, v)}
                    >
                      <SelectTrigger className="h-8 w-[140px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* GHL send / refresh */}
                    {hasGhlConnection && ghlContactId && (
                      m.ghl_invoice_id ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRefreshStatus(m)}
                          title="Refresh status"
                        >
                          <RefreshCw className="size-3.5" aria-hidden />
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendInvoice(m)}
                          title="Send invoice"
                        >
                          <Send className="size-3.5" aria-hidden />
                          <span className="hidden sm:inline">Send invoice</span>
                        </Button>
                      )
                    )}

                    {/* GHL invoice external link */}
                    {m.ghl_invoice_id && (
                      <a
                        href={`https://app.gohighlevel.com/invoices/${m.ghl_invoice_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View invoice"
                        className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                    )}

                    {/* Edit */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(m)}
                      className="px-2"
                      title="Edit milestone"
                    >
                      Edit
                    </Button>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-2 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(m.id)}
                      title="Delete milestone"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Form dialog ──────────────────────────────────────────────────── */}
      <MilestoneFormDialog
        open={formOpen}
        onClose={closeForm}
        weddingId={weddingId}
        editing={editingMilestone}
      />
    </div>
  );
}
