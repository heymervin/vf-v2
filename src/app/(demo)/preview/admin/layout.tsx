"use client"

/**
 * Admin layout — wraps all /preview/admin/* routes in the SettingsShell.
 * The shell provides the left-rail nav (desktop) and mobile sheet nav.
 *
 * Nav spec from task brief:
 *   Venue:       Profile & brand  → /preview/admin
 *                Spaces           → /preview/admin/spaces
 *   Catering:    Menu library     → /preview/admin/menu
 *                Packages & pricing → /preview/admin/packages
 *   Sales setup: Custom fields    → /preview/admin/custom-fields
 *                Messaging        → /preview/admin/messaging
 *   People:      Team & roles     → /preview/admin/team
 */

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Building2, MapPin, Utensils, Banknote, SlidersHorizontal, MessageSquare, Users } from "lucide-react"
import { SettingsShell } from "@/components/layout/settings-shell"
import type { SettingsNavGroup } from "@/components/layout/settings-shell"

const NAV_GROUPS: SettingsNavGroup[] = [
  {
    label: "Venue",
    items: [
      { label: "Profile & brand", href: "/preview/admin", icon: Building2 },
      { label: "Spaces", href: "/preview/admin/spaces", icon: MapPin },
    ],
  },
  {
    label: "Catering",
    items: [
      { label: "Menu library", href: "/preview/admin/menu", icon: Utensils },
      { label: "Packages & pricing", href: "/preview/admin/packages", icon: Banknote },
    ],
  },
  {
    label: "Sales setup",
    items: [
      { label: "Custom fields", href: "/preview/admin/custom-fields", icon: SlidersHorizontal },
      { label: "Messaging (SMS/WhatsApp)", href: "/preview/admin/messaging", icon: MessageSquare },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Team & roles", href: "/preview/admin/team", icon: Users },
    ],
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Back to app — rendered above the shell rail on desktop, above the mobile bar on mobile */}
      <div className="-mx-5 -mt-7 md:-mx-8 flex h-10 shrink-0 items-center border-b border-border bg-muted/40 px-6">
        <Link
          href="/preview"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to app
        </Link>
      </div>

      <SettingsShell groups={NAV_GROUPS} title="Settings">
        {children}
      </SettingsShell>
    </div>
  )
}
