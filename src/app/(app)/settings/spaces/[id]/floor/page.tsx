import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { FloorEditor } from "./floor-editor";

export const metadata = { title: "Floor templates" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function FloorTemplatePage({ params }: PageProps) {
  const { id } = await params;

  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const supabase = await createClient();

  // Fetch the space — must belong to this venue
  const { data: space } = await supabase
    .from("spaces")
    .select("id, name, capacity_seated, is_archived")
    .eq("id", id)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (!space) notFound();

  // Fetch existing floor templates for this space
  const { data: templates } = await supabase
    .from("floor_templates")
    .select("*")
    .eq("space_id", id)
    .eq("venue_id", ctx.venue.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  const canManage = ctx.role === "owner" || ctx.role === "admin";

  return (
    <div className="mx-auto max-w-[1100px]">
      {/* Back link */}
      <div className="mb-5">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 h-8 gap-1.5 text-xs text-muted-foreground"
          asChild
        >
          <Link href="/settings/spaces">
            <ChevronLeft className="size-3.5" />
            Spaces
          </Link>
        </Button>
      </div>

      {/* Eyebrow + title */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Floor template
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
          {space.name}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Set up a table layout template for this space. Save one or more named
          templates — the team uses these as a starting point for each wedding.
        </p>
      </div>

      <FloorEditor
        spaceId={space.id}
        spaceName={space.name}
        spaceSeatedCapacity={space.capacity_seated}
        templates={templates ?? []}
        canManage={canManage}
      />
    </div>
  );
}
