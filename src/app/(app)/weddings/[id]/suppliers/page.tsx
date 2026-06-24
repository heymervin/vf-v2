import { notFound, redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { SuppliersClient } from "./suppliers-client";
import type { Tables } from "@/lib/supabase/types";

type WeddingSupplierRow = Tables<"wedding_suppliers">;
type WeddingDocumentRow = Tables<"wedding_documents">;
type DirectorySupplierRow = Tables<"suppliers">;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("weddings")
    .select("couple_names")
    .eq("id", id)
    .maybeSingle();
  return { title: data ? `Suppliers — ${data.couple_names}` : "Suppliers" };
}

export default async function SuppliersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const supabase = await createClient();

  // Verify wedding belongs to this venue
  const { data: wedding, error: weddingError } = await supabase
    .from("weddings")
    .select("id, couple_names")
    .eq("id", id)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (weddingError) console.error("suppliers page wedding load:", weddingError.message);
  if (!wedding) notFound();

  // Wedding suppliers, wedding documents, and the venue directory are independent —
  // load them in parallel (RLS enforces venue_id on the wedding-scoped tables).
  const [
    { data: suppliersData, error: suppliersError },
    { data: documentsData, error: documentsError },
    { data: directoryData, error: directoryError },
  ] = await Promise.all([
    supabase
      .from("wedding_suppliers")
      .select("*")
      .eq("wedding_id", id)
      .order("name", { ascending: true }),
    supabase
      .from("wedding_documents")
      .select("*")
      .eq("wedding_id", id)
      .order("name", { ascending: true }),
    supabase
      .from("suppliers")
      .select("*")
      .eq("venue_id", ctx.venue.id)
      .order("name", { ascending: true }),
  ]);

  if (suppliersError) console.error("suppliers page load:", suppliersError.message);
  if (documentsError) console.error("suppliers docs load:", documentsError.message);
  if (directoryError) console.error("suppliers directory load:", directoryError.message);

  const suppliers: WeddingSupplierRow[] = (suppliersData ?? []) as WeddingSupplierRow[];
  const documents: WeddingDocumentRow[] = (documentsData ?? []) as WeddingDocumentRow[];
  const directorySuppliers: DirectorySupplierRow[] = (directoryData ?? []) as DirectorySupplierRow[];

  return (
    <div className="mx-auto max-w-[1400px]">
      <SuppliersClient
        weddingId={id}
        coupleName={wedding.couple_names}
        suppliers={suppliers}
        documents={documents}
        directorySuppliers={directorySuppliers}
      />
    </div>
  );
}
