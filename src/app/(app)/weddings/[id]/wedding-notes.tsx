"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateWeddingNotes } from "../actions";

/**
 * Editable wedding notes — the "modern Sonas" differentiator (Sonas notes are
 * immutable). Optimistic-free: just save + toast; the column already exists.
 */
export function WeddingNotes({
  weddingId,
  notes: initial,
}: {
  weddingId: string;
  notes: string | null;
}) {
  const [notes, setNotes] = React.useState(initial ?? "");
  const [saved, setSaved] = React.useState(initial ?? "");
  const [pending, startTransition] = React.useTransition();

  const dirty = notes !== saved;

  function save() {
    startTransition(async () => {
      const res = await updateWeddingNotes({ weddingId, notes });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSaved(notes);
      toast.success("Notes saved.");
    });
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Anything the team should know — access, parking, special requests, supplier quirks…"
        rows={6}
        maxLength={5000}
        className="resize-y"
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={!dirty || pending}>
          {pending ? "Saving…" : "Save notes"}
        </Button>
      </div>
    </div>
  );
}
