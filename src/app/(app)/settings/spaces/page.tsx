import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { SpacesManager } from "./spaces-manager";
import type { Tables } from "@/lib/supabase/types";

export const metadata = { title: "Spaces" };

export default async function SpacesSettingsPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const supabase = await createClient();
  const { data: spaces } = await supabase
    .from("spaces")
    .select("*")
    .eq("venue_id", ctx.venue.id)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const canManage = ctx.role === "owner" || ctx.role === "admin";

  return (
    <div className="mx-auto max-w-[900px]">
      <Link
        href="/settings"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Settings
      </Link>

      <SpacesManager
        initialSpaces={(spaces ?? []) as Tables<"spaces">[]}
        canManage={canManage}
      />
    </div>
  );
}
