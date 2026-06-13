"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  upsertAvailabilityRule,
  deleteAvailabilityRule,
  updateMeetingType,
} from "./actions";
import type { AvailabilityRuleRow, MeetingTypeRow } from "./actions";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEEKDAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

const KIND_LABEL: Record<string, string> = {
  viewing: "Venue viewing",
  call: "Discovery call",
};

// ---------------------------------------------------------------------------
// Meeting type card
// ---------------------------------------------------------------------------

function MeetingTypeCard({
  mt,
  canManage,
}: {
  mt: MeetingTypeRow;
  canManage: boolean;
}) {
  const router = useRouter();
  const [duration, setDuration] = React.useState(String(mt.duration_minutes));
  const [buffer, setBuffer] = React.useState(String(mt.buffer_minutes));
  const [enabled, setEnabled] = React.useState(mt.enabled);
  const [saving, setSaving] = React.useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const d = parseInt(duration, 10);
    const b = parseInt(buffer, 10);
    if (isNaN(d) || d < 5 || d > 480) {
      toast.error("Duration must be between 5 and 480 minutes.");
      return;
    }
    if (isNaN(b) || b < 0 || b > 120) {
      toast.error("Buffer must be between 0 and 120 minutes.");
      return;
    }
    setSaving(true);
    const result = await updateMeetingType({
      meetingTypeId: mt.id,
      durationMinutes: d,
      bufferMinutes: b,
      enabled,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${KIND_LABEL[mt.kind] ?? mt.kind} settings saved.`);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="font-semibold text-foreground">
          {KIND_LABEL[mt.kind] ?? mt.kind}
        </h3>
        {canManage && (
          <div className="flex items-center gap-2">
            <Switch
              id={`mt-${mt.id}-enabled`}
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-label={`Enable ${KIND_LABEL[mt.kind] ?? mt.kind}`}
            />
            <Label htmlFor={`mt-${mt.id}-enabled`} className="text-sm">
              {enabled ? "On" : "Off"}
            </Label>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`mt-${mt.id}-duration`}>Duration (min)</Label>
          <Input
            id={`mt-${mt.id}-duration`}
            type="number"
            min={5}
            max={480}
            className="w-28 text-[16px] sm:text-sm"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            disabled={!canManage}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`mt-${mt.id}-buffer`}>Buffer (min)</Label>
          <Input
            id={`mt-${mt.id}-buffer`}
            type="number"
            min={0}
            max={120}
            className="w-28 text-[16px] sm:text-sm"
            value={buffer}
            onChange={(e) => setBuffer(e.target.value)}
            disabled={!canManage}
          />
        </div>
        {canManage && (
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        )}
      </form>
      <p className="mt-2 text-xs text-muted-foreground">
        Buffer is dead time added after the meeting before the next slot opens.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rule row — a single time window for one member + weekday
// ---------------------------------------------------------------------------

function RuleRow({
  rule,
  canManage,
  onDeleted,
}: {
  rule: AvailabilityRuleRow;
  canManage: boolean;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = React.useState(false);

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteAvailabilityRule({ ruleId: rule.id });
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onDeleted(rule.id);
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-2.5">
      <span className="tabular-nums text-sm font-medium text-foreground">
        {rule.start_time} – {rule.end_time}
      </span>
      {canManage && (
        <button
          type="button"
          disabled={deleting}
          onClick={handleDelete}
          className="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
          aria-label="Remove window"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add-window form
// ---------------------------------------------------------------------------

function AddWindowForm({
  membershipId,
  weekday,
  onAdded,
  onCancel,
}: {
  membershipId: string;
  weekday: number;
  onAdded: (rule: AvailabilityRuleRow) => void;
  onCancel: () => void;
}) {
  const [start, setStart] = React.useState("09:00");
  const [end, setEnd] = React.useState("17:00");
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (end <= start) {
      toast.error("End time must be after start time.");
      return;
    }
    setSaving(true);
    const result = await upsertAvailabilityRule({
      membershipId,
      weekday,
      startTime: start,
      endTime: end,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onAdded(result.data);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border bg-card px-4 py-3"
    >
      <div className="space-y-1">
        <Label htmlFor="aw-start" className="text-xs">From</Label>
        <Input
          id="aw-start"
          type="time"
          className="w-32 text-[16px] sm:text-sm"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="aw-end" className="text-xs">To</Label>
        <Input
          id="aw-end"
          type="time"
          className="w-32 text-[16px] sm:text-sm"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          required
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Adding…" : "Add"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Member + weekday section
// ---------------------------------------------------------------------------

function MemberWeekdaySection({
  member,
  allRules,
  canManage,
}: {
  member: { id: string; displayName: string; role: string };
  allRules: AvailabilityRuleRow[];
  canManage: boolean;
}) {
  const [rules, setRules] = React.useState<AvailabilityRuleRow[]>(
    allRules.filter((r) => r.membership_id === member.id),
  );
  // Track which weekday is showing the add form
  const [addingWeekday, setAddingWeekday] = React.useState<number | null>(null);

  // Sync when parent rules change (e.g. router.refresh).
  // Use startTransition so the React Compiler doesn't flag synchronous setState.
  React.useEffect(() => {
    const filtered = allRules.filter((r) => r.membership_id === member.id);
    React.startTransition(() => {
      setRules(filtered);
    });
  }, [allRules, member.id]);

  function handleAdded(rule: AvailabilityRuleRow) {
    setRules((prev) => [...prev, rule]);
    setAddingWeekday(null);
  }

  function handleDeleted(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="font-semibold text-foreground capitalize">
          {member.displayName}
        </h3>
        <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
      </div>

      <div className="space-y-5">
        {WEEKDAYS.map(({ value: wd, label: dayLabel }) => {
          const dayRules = rules.filter((r) => r.weekday === wd);
          const isAdding = addingWeekday === wd;

          return (
            <div key={wd}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {dayLabel}
                </p>
                {canManage && !isAdding && (
                  <button
                    type="button"
                    onClick={() => setAddingWeekday(wd)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2"
                    aria-label={`Add window for ${dayLabel}`}
                  >
                    <Plus className="size-3" />
                    Add window
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                {dayRules.length === 0 && !isAdding && (
                  <p className="text-xs text-muted-foreground">No availability</p>
                )}
                {dayRules.map((rule) => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    canManage={canManage}
                    onDeleted={handleDeleted}
                  />
                ))}
                {isAdding && (
                  <AddWindowForm
                    membershipId={member.id}
                    weekday={wd}
                    onAdded={handleAdded}
                    onCancel={() => setAddingWeekday(null)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function AvailabilitySettings({
  rules,
  meetingTypes,
  members,
  canManage,
}: {
  rules: AvailabilityRuleRow[];
  meetingTypes: MeetingTypeRow[];
  members: { id: string; displayName: string; role: string }[];
  canManage: boolean;
}) {
  return (
    <div className="space-y-8">
      {/* Meeting type tuning */}
      <section>
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Meeting types
        </h2>
        <div className="space-y-4">
          {meetingTypes.map((mt) => (
            <MeetingTypeCard key={mt.id} mt={mt} canManage={canManage} />
          ))}
          {meetingTypes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No meeting types found. This venue may need to be re-initialised.
            </p>
          )}
        </div>
      </section>

      {/* Per-member availability */}
      <section>
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Staff availability
        </h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No team members found. Add staff members to configure their
            availability.
          </p>
        ) : (
          <div className="space-y-6">
            {members.map((m) => (
              <MemberWeekdaySection
                key={m.id}
                member={m}
                allRules={rules}
                canManage={canManage}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
