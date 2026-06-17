"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { upsertGuest, deleteGuest, type UpsertGuestInput } from "./actions";
import type { Tables } from "@/lib/supabase/types";

type GuestRow = Tables<"wedding_guests">;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GuestSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weddingId: string;
  guest?: GuestRow | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DIETARY_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Gluten free",
  "Dairy free",
  "Nut allergy",
  "Halal",
  "Kosher",
  "Other",
];

function parseDietary(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GuestSheet({ open, onOpenChange, weddingId, guest }: GuestSheetProps) {
  const isEdit = !!guest;
  const [pending, startTransition] = useTransition();
  const [deleting, startDeleteTransition] = useTransition();

  const [name, setName] = useState(guest?.name ?? "");
  const [email, setEmail] = useState(guest?.email ?? "");
  const [phone, setPhone] = useState(guest?.phone ?? "");
  const [side, setSide] = useState<UpsertGuestInput["side"]>(
    (guest?.side as UpsertGuestInput["side"]) ?? "partner1",
  );
  const [rsvp, setRsvp] = useState<UpsertGuestInput["rsvp"]>(
    (guest?.rsvp as UpsertGuestInput["rsvp"]) ?? "pending",
  );
  const [sessionType, setSessionType] = useState<UpsertGuestInput["session_type"]>(
    (guest?.session_type as UpsertGuestInput["session_type"]) ?? "day",
  );
  const [dietaryText, setDietaryText] = useState((guest?.dietary ?? []).join(", "));
  const [plusOne, setPlusOne] = useState(guest?.plus_one ?? false);
  const [plusOneName, setPlusOneName] = useState(guest?.plus_one_name ?? "");
  const [householdName, setHouseholdName] = useState(guest?.household_name ?? "");
  const [notes, setNotes] = useState(guest?.notes ?? "");

  function handleSave() {
    startTransition(async () => {
      const input: UpsertGuestInput = {
        id: isEdit ? guest.id : undefined,
        weddingId,
        name,
        email,
        phone,
        side,
        rsvp,
        session_type: sessionType,
        dietary: parseDietary(dietaryText),
        plus_one: plusOne,
        plus_one_name: plusOneName,
        household_name: householdName,
        notes,
        tags: [],
        table_number: isEdit ? (guest.table_number ?? null) : null,
      };

      const result = await upsertGuest(input);
      if (result.ok) {
        toast.success(isEdit ? "Guest updated" : "Guest added");
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    if (!isEdit) return;
    startDeleteTransition(async () => {
      const result = await deleteGuest({ guestId: guest.id, weddingId });
      if (result.ok) {
        toast.success("Guest removed");
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle>{isEdit ? "Edit guest" : "Add guest"}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="space-y-1.5">
            <Label htmlFor="guest-name">Name *</Label>
            <Input
              id="guest-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="guest-email">Email</Label>
              <Input
                id="guest-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guest-phone">Phone</Label>
              <Input
                id="guest-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Side</Label>
              <Select value={side} onValueChange={(v) => setSide(v as typeof side)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="partner1">Partner 1</SelectItem>
                  <SelectItem value="partner2">Partner 2</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>RSVP</Label>
              <Select value={rsvp} onValueChange={(v) => setRsvp(v as typeof rsvp)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="yes">Confirmed</SelectItem>
                  <SelectItem value="no">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Session</Label>
              <Select
                value={sessionType}
                onValueChange={(v) => setSessionType(v as typeof sessionType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="evening">Evening</SelectItem>
                  <SelectItem value="ceremony_only">Ceremony only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="guest-dietary">Dietary needs</Label>
            <Input
              id="guest-dietary"
              value={dietaryText}
              onChange={(e) => setDietaryText(e.target.value)}
              placeholder={`e.g. ${DIETARY_OPTIONS.slice(0, 3).join(", ")}`}
            />
            <p className="text-[11px] text-muted-foreground">Comma-separated</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="guest-household">Household / group name</Label>
            <Input
              id="guest-household"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="e.g. Henderson family"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                id="guest-plus-one"
                type="checkbox"
                checked={plusOne}
                onChange={(e) => setPlusOne(e.target.checked)}
                className="size-4 rounded border-border"
              />
              <Label htmlFor="guest-plus-one">Plus one</Label>
            </div>
            {plusOne && (
              <Input
                value={plusOneName}
                onChange={(e) => setPlusOneName(e.target.value)}
                placeholder="Plus one name (optional)"
                className="mt-2"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="guest-notes">Notes</Label>
            <Input
              id="guest-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes"
            />
          </div>
        </div>

        <SheetFooter className="flex-row items-center justify-between border-t border-border px-6 py-4">
          {isEdit ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting || pending}
            >
              {deleting ? "Removing…" : "Remove guest"}
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <SheetClose asChild>
              <Button variant="ghost" size="default" disabled={pending || deleting}>
                Cancel
              </Button>
            </SheetClose>
            <Button
              variant="default"
              size="default"
              onClick={handleSave}
              disabled={pending || !name.trim()}
            >
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add guest"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
