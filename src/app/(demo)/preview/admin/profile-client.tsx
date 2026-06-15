"use client"

/**
 * ProfileClient — interactive portion of the Venue Profile & Brand admin screen.
 * Handles optimistic form state + toast on save. Split out so the parent page
 * can remain a server component (metadata, data fetch from mock).
 */

import * as React from "react"
import { toast } from "sonner"
import { Upload, Clock, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OpeningHour {
  day: string
  open: string
  close: string
  closed: boolean
}

interface ProfileData {
  name: string
  legalName: string
  tagline: string
  timezone: string
  address: string
  phone: string
  accentSeed: string
}

interface ProfileClientProps {
  initial: ProfileData
  openingHours: OpeningHour[]
}

// ---------------------------------------------------------------------------
// Accent seed swatches — pastel tokens available in the design system.
// Venues pick a "colour direction" for their portal; the product spine stays
// fixed (it is NOT a builder). We offer 6 named seeds.
// ---------------------------------------------------------------------------

const ACCENT_SEEDS = [
  { id: "pink",  label: "Blush",     bg: "bg-fun-pink",  ring: "ring-fun-pink-strong" },
  { id: "teal",  label: "Sage",      bg: "bg-fun-teal",  ring: "ring-fun-teal-strong" },
  { id: "blue",  label: "Periwinkle",bg: "bg-fun-blue",  ring: "ring-fun-blue-strong" },
  { id: "green", label: "Meadow",    bg: "bg-fun-green",  ring: "ring-fun-green-strong" },
  { id: "mint",  label: "Mint",      bg: "bg-mint",       ring: "ring-secondary" },
  { id: "muted", label: "Neutral",   bg: "bg-muted",      ring: "ring-border" },
]

const TIMEZONES = [
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
]

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[200px_1fr] sm:items-start sm:gap-6">
      <div className="pt-0.5">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Logo drop zone
// ---------------------------------------------------------------------------

function LogoDropZone({ name }: { name: string }) {
  const [dragging, setDragging] = React.useState(false)
  const [preview, setPreview] = React.useState<string | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)

  function handleFile(file: File | undefined) {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    toast("Logo updated (prototype — not persisted)")
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handleFile(e.dataTransfer.files[0])
      }}
      onClick={() => fileRef.current?.click()}
      className={cn(
        "flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors",
        dragging
          ? "border-primary bg-accent"
          : "border-border bg-muted/30 hover:border-primary/50 hover:bg-accent/50"
      )}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Venue logo preview"
          className="max-h-16 max-w-[200px] object-contain"
        />
      ) : (
        <>
          {/* Monogram placeholder */}
          <div className="flex size-12 items-center justify-center rounded-full bg-fun-pink text-xl font-bold text-foreground">
            {name.charAt(0)}
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Drop your logo here</p>
            <p className="text-xs text-muted-foreground">PNG or SVG · max 2 MB · transparent preferred</p>
          </div>
          <Button variant="outline" size="sm" type="button" className="mt-1">
            <Upload className="size-3.5" />
            Choose file
          </Button>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Opening hours editor
// ---------------------------------------------------------------------------

function OpeningHoursEditor({ hours, onChange }: {
  hours: OpeningHour[]
  onChange: (hours: OpeningHour[]) => void
}) {
  function update(idx: number, patch: Partial<OpeningHour>) {
    onChange(hours.map((h, i) => i === idx ? { ...h, ...patch } : h))
  }

  return (
    <div className="divide-y divide-border rounded-xl border border-border">
      {hours.map((h, i) => (
        <div key={h.day} className={cn("flex min-h-[44px] items-center gap-3 px-4 py-2.5", h.closed && "opacity-50")}>
          <span className="w-[88px] shrink-0 text-sm font-medium text-foreground">{h.day.slice(0, 3)}</span>

          <button
            type="button"
            onClick={() => update(i, { closed: !h.closed })}
            className={cn(
              "inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              h.closed ? "border-border bg-muted" : "border-primary/30 bg-fun-green"
            )}
            aria-label={h.closed ? `Open ${h.day}` : `Close ${h.day}`}
          >
            <span className={cn(
              "size-3.5 rounded-full bg-white shadow transition-transform",
              h.closed ? "translate-x-0.5" : "translate-x-[18px]"
            )} />
          </button>

          {h.closed ? (
            <span className="text-xs text-muted-foreground">Closed</span>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={h.open}
                onChange={(e) => update(i, { open: e.target.value })}
                className="h-8 w-[108px] text-sm tabular-nums"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="time"
                value={h.close}
                onChange={(e) => update(i, { close: e.target.value })}
                className="h-8 w-[108px] text-sm tabular-nums"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProfileClient({ initial, openingHours: initialHours }: ProfileClientProps) {
  const [form, setForm] = React.useState<ProfileData>(initial)
  const [hours, setHours] = React.useState<OpeningHour[]>(initialHours)
  const [saving, setSaving] = React.useState(false)

  function set<K extends keyof ProfileData>(key: K, val: ProfileData[K]) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function handleSave() {
    setSaving(true)
    // Simulate async save (prototype — no backend)
    await new Promise((r) => setTimeout(r, 600))
    setSaving(false)
    toast.success("Profile saved", { description: "Your venue details have been updated." })
  }

  return (
    <div className="flex flex-col gap-10">

      {/* ------------------------------------------------------------------ */}
      {/* Section: Identity                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-6">
        <SectionLabel>Identity</SectionLabel>

        <FieldRow
          label="Logo"
          hint="Appears on brochures, emails and the couple portal."
        >
          <LogoDropZone name={form.name} />
        </FieldRow>

        <Separator />

        <FieldRow label="Venue name" hint="The trading name shown to couples.">
          <Input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="The Old Barn"
          />
        </FieldRow>

        <FieldRow label="Legal name" hint="Full registered company name for contracts.">
          <Input
            value={form.legalName}
            onChange={(e) => set("legalName", e.target.value)}
            placeholder="Old Barn Events Ltd"
          />
        </FieldRow>

        <FieldRow label="Tagline" hint="One line used in email footers and the portal header.">
          <Textarea
            value={form.tagline}
            onChange={(e) => set("tagline", e.target.value)}
            placeholder="A restored 17th-century barn in the Cotswolds"
            rows={2}
            className="resize-none"
          />
        </FieldRow>

        <FieldRow label="Accent colour" hint="Tints the couple portal — choose your brand direction.">
          <div className="flex flex-wrap gap-3">
            {ACCENT_SEEDS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => set("accentSeed", s.id)}
                aria-label={s.label}
                aria-pressed={form.accentSeed === s.id}
                className={cn(
                  "group flex flex-col items-center gap-1.5 focus-visible:outline-none",
                )}
              >
                <span className={cn(
                  "flex size-10 items-center justify-center rounded-full border-2 transition-all",
                  s.bg,
                  form.accentSeed === s.id
                    ? "border-primary shadow-md scale-110"
                    : "border-transparent hover:border-border hover:scale-105"
                )}>
                  {form.accentSeed === s.id && (
                    <Check className="size-4 text-foreground" />
                  )}
                </span>
                <span className="text-[11px] text-muted-foreground">{s.label}</span>
              </button>
            ))}
          </div>
        </FieldRow>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section: Location & contact                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-6">
        <SectionLabel>Location & contact</SectionLabel>

        <FieldRow label="Address" hint="Full address used on contracts and invoices.">
          <Textarea
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            rows={3}
            className="resize-none"
          />
        </FieldRow>

        <FieldRow label="Phone" hint="Enquiry phone number shown to couples.">
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+44 1451 000000"
          />
        </FieldRow>

        <FieldRow label="Timezone" hint="Used for appointments, sequences and run-sheets.">
          <Select value={form.timezone} onValueChange={(v) => set("timezone", v)}>
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>{tz}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section: Opening hours                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <SectionLabel>Opening hours</SectionLabel>
          <Clock className="size-3.5 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Shown on the public enquiry form and used to constrain appointment booking slots.
        </p>
        <OpeningHoursEditor hours={hours} onChange={setHours} />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Save bar                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
        <Button
          variant="ghost"
          type="button"
          onClick={() => {
            setForm(initial)
            setHours(initialHours)
          }}
        >
          Discard changes
        </Button>
        <Button
          variant="default"
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="min-w-[100px]"
        >
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </div>
  )
}
