"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Mail,
  MessageSquare,
  Phone,
  Calendar,
  Users,
  Banknote,
  ArrowRight,
  Flame,
  Thermometer,
  Snowflake,
  CheckCircle2,
  Circle,
  Tag,
  Pencil,
  Check,
  X,
  Clock,
  ArrowUpRight,
  Heart,
  ListTodo,
  Activity,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StageBadge } from "@/components/stage-badge";
import { TagChip } from "@/components/tag-chip";
import { NextActionCallout } from "@/components/next-action-callout";
import { AssigneePopover } from "@/components/assignee-popover";
import { WeddingStatusBadge } from "@/components/status-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  type Contact,
  type LeadScore,
  type Channel,
  type ContactActivity,
  type ContactNote,
  type ContactTask,
  type ContactCustomField,
  type Wedding,
  TEAM,
  gbp,
  formatLongDate,
  formatMessageTime,
  teamMember,
  daysFromToday,
} from "@/lib/mock";

// ---------------------------------------------------------------------------
// Channel meta
// ---------------------------------------------------------------------------

const CHANNEL_META: Record<Channel, { label: string; Icon: React.ElementType; chipClass: string }> = {
  email:    { label: "Email",    Icon: Mail,          chipClass: "bg-fun-blue text-foreground" },
  sms:      { label: "SMS",      Icon: Phone,         chipClass: "bg-fun-teal text-foreground" },
  whatsapp: { label: "WhatsApp", Icon: MessageSquare, chipClass: "bg-fun-green text-foreground" },
};

// ---------------------------------------------------------------------------
// Score meta
// ---------------------------------------------------------------------------

const SCORE_META: Record<LeadScore, { label: string; Icon: React.ElementType; chipClass: string }> = {
  hot:  { label: "Hot",  Icon: Flame,       chipClass: "bg-destructive/15 text-destructive" },
  warm: { label: "Warm", Icon: Thermometer, chipClass: "bg-warning text-warning-foreground" },
  cold: { label: "Cold", Icon: Snowflake,   chipClass: "bg-fun-blue text-foreground" },
};

// ---------------------------------------------------------------------------
// Activity kind meta
// ---------------------------------------------------------------------------

const ACTIVITY_KIND_META: Record<ContactActivity["kind"], { label: string; Icon: React.ElementType; iconClass: string }> = {
  message:      { label: "Message",      Icon: MessageCircle, iconClass: "text-fun-blue-strong" },
  note:         { label: "Note",         Icon: Pencil,        iconClass: "text-muted-foreground" },
  stage_change: { label: "Stage change", Icon: ArrowRight,    iconClass: "text-fun-teal-strong" },
  task:         { label: "Task",         Icon: ListTodo,      iconClass: "text-warning-foreground" },
  call:         { label: "Call",         Icon: Phone,         iconClass: "text-fun-green-strong" },
  system:       { label: "System",       Icon: Activity,      iconClass: "text-muted-foreground/60" },
};

// ---------------------------------------------------------------------------
// Prop types
// ---------------------------------------------------------------------------

interface ContactDetailClientProps {
  contact: Contact;
  messages: import("@/lib/mock").Message[];
  activities: ContactActivity[];
  notes: ContactNote[];
  tasks: ContactTask[];
  wedding: Wedding | undefined;
  ownerId: string;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ContactDetailClient({
  contact,
  messages,
  activities,
  notes,
  tasks,
  wedding,
  ownerId,
}: ContactDetailClientProps) {
  const [currentOwnerId, setCurrentOwnerId] = useState(ownerId);

  const scoreMeta = SCORE_META[contact.score];
  const ScoreIcon = scoreMeta.Icon;
  const owner = teamMember(currentOwnerId);

  // Derive the tab to default to based on contact state
  const defaultTab = contact.stage === "wedding_booked" && wedding ? "wedding" : "activity";

  function handleAssign(id: string) {
    setCurrentOwnerId(id);
    const member = TEAM.find((m) => m.id === id);
    toast.success(`Assigned to ${member?.name ?? id}`);
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* ── Meta chips row ── */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StageBadge stage={contact.stage} />

        {/* Lead score */}
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
            scoreMeta.chipClass,
          )}
        >
          <ScoreIcon className="size-3" aria-hidden />
          {scoreMeta.label}
        </span>

        {/* Source */}
        <Badge variant="outline">{contact.source}</Badge>

        {/* Tags */}
        {(contact.tags ?? []).map((tag) => (
          <TagChip key={tag} tag={tag} />
        ))}

        {/* Spacer + owner */}
        <span className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Owner: <span className="font-medium text-foreground">{owner?.name ?? "—"}</span>
          </span>
          <AssigneePopover
            team={TEAM}
            currentOwnerId={currentOwnerId}
            onAssign={handleAssign}
          />
        </span>
      </div>

      {/* ── Next action callout ── */}
      {contact.nextAction && (
        <div className="mb-6">
          <NextActionCallout
            severity={contact.dateHoldExpiresAt ? "warning" : "info"}
            title={contact.nextAction.label}
            detail={
              contact.nextAction.due
                ? `Due ${formatLongDate(contact.nextAction.due)}`
                : undefined
            }
          />
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {/* ── Left: Tabs ── */}
        <Tabs defaultValue={defaultTab} className="min-w-0">
          <TabsList className="mb-4 w-full justify-start gap-1 border-b border-border bg-transparent pb-0 rounded-none">
            <TabsTrigger
              value="activity"
              className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 pb-2 pt-1 text-sm"
            >
              <Activity className="size-3.5" aria-hidden />
              Activity
            </TabsTrigger>
            <TabsTrigger
              value="conversation"
              className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 pb-2 pt-1 text-sm"
            >
              <MessageCircle className="size-3.5" aria-hidden />
              Conversation
              {messages.filter((m) => m.direction === "in").length > 0 && (
                <span className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {messages.length}
                </span>
              )}
            </TabsTrigger>
            {wedding && (
              <TabsTrigger
                value="wedding"
                className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 pb-2 pt-1 text-sm"
              >
                <Heart className="size-3.5" aria-hidden />
                Wedding
              </TabsTrigger>
            )}
            <TabsTrigger
              value="details"
              className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 pb-2 pt-1 text-sm"
            >
              <ListTodo className="size-3.5" aria-hidden />
              Details
            </TabsTrigger>
          </TabsList>

          {/* Activity tab */}
          <TabsContent value="activity" className="mt-0">
            <ActivityTab activities={activities} notes={notes} tasks={tasks} contact={contact} />
          </TabsContent>

          {/* Conversation tab */}
          <TabsContent value="conversation" className="mt-0">
            <ConversationTab messages={messages} contact={contact} />
          </TabsContent>

          {/* Wedding tab */}
          {wedding && (
            <TabsContent value="wedding" className="mt-0">
              <WeddingTab wedding={wedding} />
            </TabsContent>
          )}

          {/* Details tab */}
          <TabsContent value="details" className="mt-0">
            <DetailsTab contact={contact} />
          </TabsContent>
        </Tabs>

        {/* ── Right rail ── */}
        <aside className="flex flex-col gap-4">
          <KeyFactsCard contact={contact} />
          <QuickActionsCard contact={contact} />
          {wedding && <WeddingWorkspaceCard wedding={wedding} />}
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity tab
// ---------------------------------------------------------------------------

function ActivityTab({
  activities,
  notes,
  tasks,
  contact,
}: {
  activities: ContactActivity[];
  notes: ContactNote[];
  tasks: ContactTask[];
  contact: Contact;
}) {
  const [taskState, setTaskState] = useState<Record<string, boolean>>(
    Object.fromEntries(tasks.map((t) => [t.id, t.done])),
  );

  function toggleTask(id: string) {
    setTaskState((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      const done = next[id];
      toast.success(done ? "Task marked done" : "Task reopened");
      return next;
    });
  }

  // Merge activities + notes into a single timeline, newest first
  const timeline = [
    ...activities.map((a) => ({
      id: a.id,
      at: a.at,
      kind: a.kind as ContactActivity["kind"],
      author: a.author,
      summary: a.summary,
      channel: a.channel,
    })),
    ...notes.map((n) => ({
      id: n.id,
      at: n.at,
      kind: "note" as ContactActivity["kind"],
      author: n.author,
      summary: n.body,
      channel: undefined,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="flex flex-col gap-5">
      {/* Open tasks */}
      {tasks.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Open tasks
            </p>
          </div>
          <ul className="divide-y divide-border">
            {tasks.map((task) => {
              const done = taskState[task.id] ?? task.done;
              const assignee = teamMember(task.assigneeId);
              return (
                <li key={task.id} className="flex min-h-[44px] items-start gap-3 px-4 py-3">
                  <Checkbox
                    checked={done}
                    onCheckedChange={() => toggleTask(task.id)}
                    aria-label={task.label}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm text-foreground",
                        done && "line-through text-muted-foreground",
                      )}
                    >
                      {task.label}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      {task.dueDate && (
                        <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                          <Clock className="size-3" aria-hidden />
                          {formatLongDate(task.dueDate)}
                        </span>
                      )}
                      {assignee && (
                        <span className="text-xs text-muted-foreground">· {assignee.name}</span>
                      )}
                    </div>
                  </div>
                  {done && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-fun-green-strong" aria-hidden />}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Timeline */}
      {timeline.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <Activity className="mx-auto mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">No activity yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Messages, notes, and stage changes will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Timeline
            </p>
          </div>
          <ul className="divide-y divide-border">
            {timeline.map((item) => {
              const meta = ACTIVITY_KIND_META[item.kind];
              const Icon = meta.Icon;
              return (
                <li key={item.id} className="flex items-start gap-3 px-4 py-3 min-h-[44px]">
                  <span
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted",
                    )}
                    aria-hidden
                  >
                    <Icon className={cn("size-3", meta.iconClass)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{item.summary}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">{item.author}</span>
                      {item.channel && (
                        <>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-semibold",
                              CHANNEL_META[item.channel].chipClass,
                            )}
                          >
                            {CHANNEL_META[item.channel].label}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatMessageTime(item.at)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversation tab
// ---------------------------------------------------------------------------

function ConversationTab({
  messages,
  contact,
}: {
  messages: import("@/lib/mock").Message[];
  contact: Contact;
}) {
  if (messages.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center shadow-sm">
        <MessageCircle className="mx-auto mb-3 size-8 text-muted-foreground/40" />
        <p className="text-sm font-semibold text-foreground">No messages yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a reply via Email, SMS or WhatsApp and it will appear here in one unified thread.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <ul className="divide-y divide-border">
        {messages.map((msg) => {
          const ch = CHANNEL_META[msg.channel];
          const ChIcon = ch.Icon;
          const isOut = msg.direction === "out";
          return (
            <li key={msg.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    ch.chipClass,
                  )}
                >
                  <ChIcon className="size-3" aria-hidden />
                  {ch.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {isOut ? msg.author : contact.coupleName}
                </span>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {formatMessageTime(msg.at)}
                </span>
              </div>
              <p
                className={cn(
                  "mt-2 text-sm leading-relaxed",
                  isOut ? "text-foreground" : "font-medium text-foreground",
                )}
              >
                {msg.body}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wedding tab
// ---------------------------------------------------------------------------

function WeddingTab({ wedding }: { wedding: Wedding }) {
  const days = daysFromToday(wedding.date);
  const isPast = days < 0;

  const pendingTasks = wedding.tasks.filter((t) => !t.done);
  const doneTasks = wedding.tasks.filter((t) => t.done);
  const paidPct = Math.round((wedding.paid / wedding.totalValue) * 100);

  return (
    <div className="flex flex-col gap-5">
      {/* Wedding summary */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Wedding overview
            </p>
            <WeddingStatusBadge status={wedding.status} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          {[
            { label: "Date", value: formatLongDate(wedding.date) },
            { label: "Space", value: wedding.space },
            { label: "Guests", value: `${wedding.guestCount}` },
            { label: "Package", value: wedding.packageName },
          ].map(({ label, value }) => (
            <div key={label} className="bg-card px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {label}
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Payment health */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Payments
          </p>
        </div>
        <div className="px-5 py-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {gbp(wedding.paid)} collected
            </span>
            <span className="tabular-nums font-medium text-foreground">
              {paidPct}% of {gbp(wedding.totalValue)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-fun-green-strong transition-all"
              style={{ width: `${paidPct}%` }}
              role="progressbar"
              aria-valuenow={paidPct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <ul className="mt-3 space-y-2">
            {wedding.payments.map((pm) => (
              <li key={pm.id} className="flex items-center gap-2 text-sm">
                {pm.status === "paid" ? (
                  <CheckCircle2 className="size-4 shrink-0 text-fun-green-strong" aria-hidden />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span
                  className={cn(
                    "flex-1",
                    pm.status === "paid" ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {pm.label}
                </span>
                <span className="tabular-nums text-foreground">{gbp(pm.amount)}</span>
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    pm.status === "overdue"
                      ? "text-destructive font-semibold"
                      : pm.status === "due"
                      ? "text-warning-foreground font-semibold"
                      : "text-muted-foreground",
                  )}
                >
                  {formatLongDate(pm.dueDate)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Planning tasks */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Planning tasks — {doneTasks.length}/{wedding.tasks.length} done
          </p>
        </div>
        <ul className="divide-y divide-border">
          {wedding.tasks.map((task) => (
            <li key={task.id} className="flex min-h-[44px] items-center gap-3 px-5 py-2.5">
              {task.done ? (
                <CheckCircle2 className="size-4 shrink-0 text-fun-green-strong" aria-hidden />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span
                className={cn(
                  "flex-1 text-sm",
                  task.done && "text-muted-foreground line-through",
                )}
              >
                {task.label}
              </span>
              {task.dueDate && (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatLongDate(task.dueDate)}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Open workspace CTA */}
      <Link href={`/preview/weddings/${wedding.id}`}>
        <Button variant="outline" className="w-full gap-2">
          Open Wedding Workspace
          <ArrowUpRight className="size-4" aria-hidden />
        </Button>
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Details tab (editable custom fields + tags)
// ---------------------------------------------------------------------------

function DetailsTab({ contact }: { contact: Contact }) {
  const [fields, setFields] = useState<ContactCustomField[]>(
    contact.customFields ?? [],
  );
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");

  function startEdit(key: string, current: string | number | null) {
    setEditingKey(key);
    setDraft(current != null ? String(current) : "");
  }

  function commitEdit(key: string) {
    setFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, value: draft } : f)),
    );
    setEditingKey(null);
    toast.success("Field updated");
  }

  function cancelEdit() {
    setEditingKey(null);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Custom fields */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Custom fields
          </p>
        </div>

        {fields.length === 0 ? (
          <div className="px-5 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              No custom fields have been filled in yet.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Configure field definitions in{" "}
              <Link href="/preview/admin/custom-fields" className="underline">
                Admin → Custom fields
              </Link>
              .
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {fields.map((field) => {
              const isEditing = editingKey === field.key;
              return (
                <li
                  key={field.key}
                  className="group flex min-h-[44px] items-center gap-3 px-5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {field.label}
                    </p>
                    {isEditing ? (
                      <Input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit(field.key);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className="mt-1 h-7 text-sm"
                      />
                    ) : (
                      <p className="mt-0.5 text-sm text-foreground">
                        {field.value != null && field.value !== "" ? (
                          String(field.value)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Edit / commit / cancel */}
                  {isEditing ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => commitEdit(field.key)}
                        aria-label="Save"
                        className="flex size-7 items-center justify-center rounded-md text-fun-green-strong hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Check className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        aria-label="Cancel"
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(field.key, field.value)}
                      aria-label={`Edit ${field.label}`}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Tags */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Tags
          </p>
        </div>
        <div className="px-5 py-4">
          {(contact.tags ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No tags applied.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(contact.tags ?? []).map((tag) => (
                <TagChip key={tag} tag={tag} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contact info */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Contact info
          </p>
        </div>
        <dl className="divide-y divide-border">
          {[
            { label: "Email", value: contact.email, icon: <Mail className="size-3.5" aria-hidden /> },
            { label: "Phone", value: contact.phone, icon: <Phone className="size-3.5" aria-hidden /> },
          ].map(({ label, value, icon }) => (
            <div key={label} className="flex items-center gap-3 px-5 py-3">
              <span className="shrink-0 text-muted-foreground">{icon}</span>
              <dt className="w-16 shrink-0 text-xs text-muted-foreground">{label}</dt>
              <dd className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right rail cards
// ---------------------------------------------------------------------------

function KeyFactsCard({ contact }: { contact: Contact }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Key facts</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2.5">
          {contact.weddingDate && (
            <FactRow
              icon={<Calendar className="size-3.5" aria-hidden />}
              label="Wedding date"
              value={<span className="tabular-nums">{formatLongDate(contact.weddingDate)}</span>}
            />
          )}
          {contact.guestCount != null && (
            <FactRow
              icon={<Users className="size-3.5" aria-hidden />}
              label="Guests"
              value={<span className="tabular-nums">{contact.guestCount}</span>}
            />
          )}
          {contact.budget != null && (
            <FactRow
              icon={<Banknote className="size-3.5" aria-hidden />}
              label="Budget"
              value={<span className="tabular-nums">{gbp(contact.budget)}</span>}
            />
          )}
          <FactRow
            icon={<Tag className="size-3.5" aria-hidden />}
            label="Source"
            value={contact.source}
          />
          <FactRow
            icon={<Calendar className="size-3.5" aria-hidden />}
            label="Enquired"
            value={<span className="tabular-nums">{formatLongDate(contact.createdAt)}</span>}
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function QuickActionsCard({ contact }: { contact: Contact }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Quick actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <Button
            variant="default"
            className="w-full justify-start gap-2"
            onClick={() => toast.success("Opening message composer…")}
          >
            <MessageSquare className="size-4" aria-hidden />
            Message couple
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => toast.success("Opening booking form…")}
          >
            <Calendar className="size-4" aria-hidden />
            Book viewing
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => toast.success("Creating new proposal…")}
          >
            <Banknote className="size-4" aria-hidden />
            Send proposal
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FactRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <dt className="w-24 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-right text-xs font-medium text-foreground">{value}</dd>
    </div>
  );
}

function WeddingWorkspaceCard({ wedding }: { wedding: Wedding }) {
  const days = daysFromToday(wedding.date);
  const isPast = days < 0;
  const countdownLabel = isPast
    ? `${Math.abs(days)} days ago`
    : days === 0
    ? "Today"
    : `${days} days away`;

  return (
    <Card size="sm" className="border-fun-green-strong/30 bg-fun-green/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Heart className="size-4 text-fun-green-strong" aria-hidden />
          <CardTitle className="text-sm">Wedding Workspace</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium text-foreground">{wedding.coupleName}</p>
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          {formatLongDate(wedding.date)}
        </p>
        <span
          className={cn(
            "mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums",
            isPast ? "bg-muted text-muted-foreground" : "bg-fun-green text-foreground",
          )}
        >
          {countdownLabel}
        </span>
        <div className="mt-4">
          <Link href={`/preview/weddings/${wedding.id}`}>
            <Button variant="outline" size="sm" className="w-full gap-1.5">
              Open Workspace
              <ArrowRight className="size-3.5" aria-hidden />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
