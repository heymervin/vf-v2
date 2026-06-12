import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "../../contacts/format";
import { BrochureUpload } from "./brochure-upload";

export const metadata = { title: "Brochure" };

export default async function BrochureSettingsPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");
  const canManage = ctx.role === "owner" || ctx.role === "admin";

  const supabase = await createClient();
  const { data: brochure } = await supabase
    .from("brochures")
    .select("title, download_token, download_count, last_downloaded_at, created_at")
    .eq("venue_id", ctx.venue.id)
    .eq("is_active", true)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-[680px]">
      <Link
        href="/settings"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Settings
      </Link>

      <h1 className="text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
        Brochure
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        The PDF here is emailed automatically to every new enquiry. One active
        brochure at a time.
      </p>

      {/* Current brochure */}
      <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        {brochure ? (
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-fun-pink text-fun-pink-foreground">
              <FileText className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">
                {brochure.title ?? "Wedding brochure"}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                {brochure.download_count} download
                {brochure.download_count === 1 ? "" : "s"}
                {brochure.last_downloaded_at
                  ? ` · last ${formatDateTime(brochure.last_downloaded_at)}`
                  : ""}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <a href={`/b/${brochure.download_token}`} target="_blank" rel="noreferrer">
                  Preview
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No brochure yet. Upload one so couples receive it the moment they
            enquire.
          </p>
        )}
      </div>

      {/* Upload */}
      {canManage ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {brochure ? "Replace brochure" : "Upload brochure"}
          </h2>
          <BrochureUpload hasActive={!!brochure} />
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          Only owners and admins can change the brochure.
        </p>
      )}
    </div>
  );
}
