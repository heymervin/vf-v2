import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { SpacesManager } from "./spaces-manager";

export const metadata = { title: "Spaces" };

export default async function SpacesSettingsPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");
  const canManage = ctx.role === "owner" || ctx.role === "admin";

  const supabase = await createClient();
  const { data: spaces } = await supabase
    .from("spaces")
    .select("*")
    .eq("venue_id", ctx.venue.id)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-[680px]">
      <Link
        href="/settings"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Settings
      </Link>

      <h1 className="text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
        Spaces
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Add and manage the spaces available at your venue. Spaces help couples
        understand your offering and appear in your enquiry form.
      </p>

      {!canManage && (
        <p className="mt-6 text-sm text-muted-foreground">
          Only owners and admins can manage spaces.
        </p>
      )}

      <div className="mt-8">
        <SpacesManager
          initialSpaces={spaces ?? []}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
