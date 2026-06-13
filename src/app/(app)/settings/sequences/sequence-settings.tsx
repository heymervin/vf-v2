"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateSequence, updateSequenceStep } from "./actions";
import type { SequenceRow, SequenceStepRow } from "./actions";

const MERGE_TAGS = ["{{first_name}}", "{{venue_name}}", "{{partner_name}}"];

function humanizeDelay(hours: number): string {
  if (hours === 0) return "immediately after the previous email";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} after the previous email`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} after the previous email`;
}

interface StepCardProps {
  step: SequenceStepRow;
  canManage: boolean;
}

function StepCard({ step, canManage }: StepCardProps) {
  const router = useRouter();
  const [subject, setSubject] = React.useState(step.subject);
  const [body, setBody] = React.useState(step.body);
  const [delayHours, setDelayHours] = React.useState(String(step.delay_hours));
  const [enabled, setEnabled] = React.useState(step.enabled);
  const [saving, setSaving] = React.useState(false);

  const stepId = `step-${step.step_number}`;
  const subjectId = `${stepId}-subject`;
  const bodyId = `${stepId}-body`;
  const delayId = `${stepId}-delay`;
  const enabledId = `${stepId}-enabled`;

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsedDelay = parseInt(delayHours, 10);
    if (isNaN(parsedDelay) || parsedDelay < 0 || parsedDelay > 720) {
      toast.error("Delay must be between 0 and 720 hours.");
      return;
    }
    setSaving(true);
    const result = await updateSequenceStep({
      stepId: step.id,
      subject,
      body,
      delay_hours: parsedDelay,
      enabled,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Step ${step.step_number} saved.`);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Step {step.step_number}
        </h2>
        {canManage && (
          <div className="flex items-center gap-2">
            <Switch
              id={enabledId}
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-label={`Enable step ${step.step_number}`}
            />
            <Label htmlFor={enabledId} className="text-sm">
              {enabled ? "On" : "Off"}
            </Label>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={subjectId}>
            Subject <span aria-hidden="true">*</span>
          </Label>
          <Input
            id={subjectId}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            disabled={!canManage}
            className="text-[16px] sm:text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={bodyId}>
            Body <span aria-hidden="true">*</span>
          </Label>
          <Textarea
            id={bodyId}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={8}
            disabled={!canManage}
            className="resize-y text-[16px] sm:text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={delayId}>
            Delay (hours) <span aria-hidden="true">*</span>
          </Label>
          <Input
            id={delayId}
            type="number"
            min={0}
            max={720}
            value={delayHours}
            onChange={(e) => setDelayHours(e.target.value)}
            required
            disabled={!canManage}
            className="w-32 text-[16px] sm:text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {humanizeDelay(parseInt(delayHours, 10) || 0)}
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Available merge tags
          </p>
          <div className="flex flex-wrap gap-1.5">
            {MERGE_TAGS.map((tag) => (
              <code
                key={tag}
                className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground"
              >
                {tag}
              </code>
            ))}
          </div>
        </div>

        {canManage && (
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save step"}
          </Button>
        )}
      </form>
    </div>
  );
}

interface SequenceSettingsProps {
  sequence: SequenceRow;
  steps: SequenceStepRow[];
  canManage: boolean;
}

export function SequenceSettings({
  sequence,
  steps,
  canManage,
}: SequenceSettingsProps) {
  const router = useRouter();
  const [enabled, setEnabled] = React.useState(sequence.enabled);
  const [toggling, setToggling] = React.useState(false);

  async function handleToggle(next: boolean) {
    setEnabled(next);
    setToggling(true);
    const result = await updateSequence({
      sequenceId: sequence.id,
      enabled: next,
    });
    setToggling(false);
    if (!result.ok) {
      setEnabled(!next);
      toast.error(result.error);
      return;
    }
    toast.success(next ? "Nurture sequence enabled." : "Nurture sequence disabled.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Master switch */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">Nurture sequence</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Automatically sends up to 3 follow-up emails to new enquiries.
              Stops automatically when an enquiry moves stage or replies.
            </p>
          </div>
          {canManage ? (
            <Switch
              id="sequence-enabled"
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={toggling}
              aria-label="Enable nurture sequence"
            />
          ) : (
            <Switch
              id="sequence-enabled"
              checked={enabled}
              disabled
              aria-label="Nurture sequence status"
            />
          )}
        </div>
      </div>

      {/* Step cards */}
      {steps.map((step) => (
        <StepCard key={step.id} step={step} canManage={canManage} />
      ))}
    </div>
  );
}
