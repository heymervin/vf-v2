import { CustomFieldsClient } from "./custom-fields-client"

export const metadata = { title: "Custom fields · Admin" }

/**
 * /preview/admin/custom-fields
 *
 * The bounded escape-hatch — a capped, opinionated list of custom fields
 * that venues can define to capture context not covered by the fixed schema.
 * NOT a field builder. Capped at 12 fields. Content/identity editing only
 * (per PRODUCT.md anti-config philosophy).
 *
 * Page renders plain content — the SettingsShell/layout is owned by the
 * admin layout agent, so no shell or PageHeader here.
 */
export default function CustomFieldsPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Eyebrow + page heading */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Sales setup
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.022em] leading-[1.1] text-foreground">
          Custom fields
        </h2>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Add venue-specific fields to your enquiry form and contact records — things like preferred space, how couples found you, or a budget band. These slot into VenueFlow&apos;s fixed data model without bending it.
        </p>
      </div>

      <CustomFieldsClient />
    </div>
  )
}
