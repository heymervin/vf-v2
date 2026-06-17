import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createAdminClient } from "@/lib/supabase/admin";
import { MenuLibraryClient } from "./menu-library";

export const metadata = { title: "Menu library" };

export default async function MenuLibraryPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const canManage = ctx.role === "owner" || ctx.role === "admin";

  const admin = createAdminClient();

  const { data: items, error } = await admin
    .from("menu_items")
    .select("*")
    .eq("venue_id", ctx.venue.id)
    .order("sort_order", { ascending: true });

  if (error) {
    return (
      <div className="mx-auto max-w-[900px]">
        <p className="text-sm text-destructive">
          Could not load menu library. Please try again.
        </p>
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

      <MenuLibraryClient
        initialItems={items ?? []}
        canManage={canManage}
      />
    </div>
  );
}
