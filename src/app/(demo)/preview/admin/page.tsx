/**
 * /preview/admin — Venue Profile & Brand
 *
 * Server component: pulls seed data from the mock layer and hands it to the
 * interactive ProfileClient child. No auth gate — this is the prototype
 * showcase. Admin layout (SettingsShell) is applied by layout.tsx.
 */

import { VENUE } from "@/lib/mock"
import { ProfileClient } from "./profile-client"

export const metadata = { title: "Profile & brand · Settings" }

// Default opening hours — sensible UK venue defaults.
// The VENUE mock doesn't carry opening hours yet; we seed them here so the
// editor is immediately useful. (Brief gap call: documented as a deviation.)
const DEFAULT_HOURS = [
  { day: "Monday",    open: "09:00", close: "17:00", closed: false },
  { day: "Tuesday",   open: "09:00", close: "17:00", closed: false },
  { day: "Wednesday", open: "09:00", close: "17:00", closed: false },
  { day: "Thursday",  open: "09:00", close: "17:00", closed: false },
  { day: "Friday",    open: "09:00", close: "18:00", closed: false },
  { day: "Saturday",  open: "10:00", close: "17:00", closed: false },
  { day: "Sunday",    open: "10:00", close: "16:00", closed: false },
]

export default function AdminProfilePage() {
  const initial = {
    name: VENUE.name,
    legalName: "Old Barn Events Ltd",
    tagline: VENUE.tagline,
    timezone: "Europe/London",
    address: "The Old Barn, Burford Road\nChipping Norton\nOxfordshire OX7 3AB\nUnited Kingdom",
    phone: "+44 1451 000000",
    accentSeed: "pink",
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Eyebrow + heading — per brief: no PageHeader/shell, plain content */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Venue
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-[-0.022em] text-foreground">
          Profile &amp; brand
        </h2>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Your venue&apos;s identity — shown to couples on brochures, emails and the
          planning portal. Changes take effect on the next send.
        </p>
      </div>

      <ProfileClient initial={initial} openingHours={DEFAULT_HOURS} />
    </div>
  )
}
