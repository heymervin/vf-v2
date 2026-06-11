import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { CopyField } from "../copy-field";

export const metadata = { title: "Enquiry form" };

export default async function FormsSettingsPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.venueflow.io";
  const publicUrl = `${appUrl}/f/${ctx.venue.slug}`;
  const embedSnippet = `<iframe src="${publicUrl}/embed" width="100%" height="760" style="border:0;max-width:560px" title="Enquiry form for ${ctx.venue.name}"></iframe>`;

  return (
    <div className="mx-auto max-w-[680px]">
      <Link
        href="/settings"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Settings
      </Link>

      <h1 className="text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
        Enquiry form
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Share your form link, or embed it on your website. Every submission
        lands in your pipeline tagged with its source.
      </p>

      {/* Public link */}
      <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Shareable link
          </h2>
          <Button asChild variant="ghost" size="sm">
            <a href={publicUrl} target="_blank" rel="noreferrer">
              Open <ExternalLink />
            </a>
          </Button>
        </div>
        <CopyField label="form link" value={publicUrl} />
      </div>

      {/* Embed */}
      <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Embed on your website
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Paste this where you want the form to appear. It blends into your
          page&apos;s background.
        </p>
        <CopyField label="embed code" value={embedSnippet} multiline />
      </div>
    </div>
  );
}
