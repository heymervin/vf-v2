import { PACKAGES, MENU_LIBRARY } from "@/lib/mock"
import { PackagesClient } from "./packages-client"

export const metadata = { title: "Packages & pricing" }

/**
 * Admin — Packages & pricing
 *
 * Server shell: passes seeded data down to the interactive client component.
 * Lives under /preview/admin which is wrapped by the SettingsShell layout
 * (built by the shell agent). This page renders content only — no PageHeader,
 * no extra shell.
 */
export default function PackagesPage() {
  return (
    <div className="flex flex-col gap-5">
      {/* Eyebrow + title */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Catering
        </p>
        <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">
          Packages &amp; pricing
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Define the packages and add-ons you offer. Prices set here flow
          directly into the proposal builder — couples see what you charge, not
          a template.
        </p>
      </div>

      <PackagesClient
        initialPackages={PACKAGES}
        menuLibrary={MENU_LIBRARY}
      />
    </div>
  )
}
