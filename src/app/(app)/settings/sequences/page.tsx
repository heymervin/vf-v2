import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { getOrCreateSequence } from "./actions";
import { SequenceSettings } from "./sequence-settings";

export const metadata = { title: "Nurture sequence" };

export default async function SequencesSettingsPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const result = await getOrCreateSequence();
  if (!result.ok) {
    return (
      <div className="mx-auto max-w-[680px]">
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    );
  }

  const canManage = ctx.role === "owner" || ctx.role === "admin";

  return (
    <div className="mx-auto max-w-[680px]">
      <Link
        href="/settings"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Settings
      </Link>

      <h1 className="text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
        Nurture sequence
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Edit the follow-up emails sent to new enquiries. The 3-step structure is
        fixed — you control the content, timing, and whether each step is active.
      </p>

      <div className="mt-8">
        <SequenceSettings
          sequence={result.data.sequence}
          steps={result.data.steps}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
