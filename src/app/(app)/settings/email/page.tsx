import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { EmailForm } from "./email-form";

export const metadata = { title: "Email identity" };

export default async function EmailSettingsPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");
  const canManage = ctx.role === "owner" || ctx.role === "admin";

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("venue_email_settings")
    .select("from_name, reply_to")
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  const defaultFromName = settings?.from_name ?? ctx.venue.name;
  const defaultReplyTo = settings?.reply_to ?? (ctx.user.email ?? "");

  return (
    <div className="mx-auto max-w-[680px]">
      <Link
        href="/settings"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Settings
      </Link>

      <h1 className="text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
        Email identity
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        All mail — brochure delivery, enquiry confirmations — is sent from the
        shared VenueFlow sending domain. Set your display name and reply-to
        address so couples see your brand and can reply directly to you.
      </p>

      {/* Info card */}
      <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Mail className="size-4" />
        </div>
        <p className="text-sm text-muted-foreground">
          Emails arrive from{" "}
          <span className="font-medium text-foreground">
            {defaultFromName} via mail.venueflow.io
          </span>
          . Replies from couples go to your reply-to address — not VenueFlow.
        </p>
      </div>

      {/* Form */}
      {canManage ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Sending identity
          </h2>
          <EmailForm
            defaultFromName={defaultFromName}
            defaultReplyTo={defaultReplyTo}
          />
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          Only owners and admins can update email settings.
        </p>
      )}
    </div>
  );
}
