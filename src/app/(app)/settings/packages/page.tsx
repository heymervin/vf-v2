import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { getPackages } from "./actions";
import { PackagesManager } from "./packages-manager";

export const metadata = { title: "Packages & pricing" };

export default async function PackagesSettingsPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const canManage = ctx.role === "owner" || ctx.role === "admin";

  const result = await getPackages();
  if (!result.ok) {
    return (
      <div className="mx-auto max-w-[900px]">
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px]">
      <Link
        href="/settings"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Settings
      </Link>

      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Catering
        </p>
        <h1 className="mt-0.5 text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
          Packages &amp; pricing
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Define the packages and add-ons you offer. Prices set here flow
          directly into the proposal builder.
        </p>
      </div>

      <PackagesManager
        initialPackages={result.data.packages}
        initialAddOns={result.data.addOns}
        canManage={canManage}
      />
    </div>
  );
}
