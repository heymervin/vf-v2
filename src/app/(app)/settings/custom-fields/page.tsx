import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { listCustomFields } from "./actions";
import { CustomFieldsManager } from "./custom-fields-manager";

export const metadata = { title: "Custom fields" };

export default async function CustomFieldsPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const result = await listCustomFields();

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-[780px]">
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    );
  }

  const canManage = ctx.role === "owner" || ctx.role === "admin";

  return (
    <div className="mx-auto max-w-[780px]">
      <Link
        href="/settings"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Settings
      </Link>

      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Sales setup
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
          Custom fields
        </h1>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          Add venue-specific fields to your enquiry form and contact records —
          things like preferred space, how couples found you, or a budget band.
          These slot into VenueFlow&apos;s fixed data model without bending it.
        </p>
      </div>

      <CustomFieldsManager
        initialFields={result.data}
        canManage={canManage}
      />
    </div>
  );
}
