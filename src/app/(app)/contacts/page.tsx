import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { PageHeader } from "@/components/layout/page-header";
import { ContactsList, type ContactRow } from "./contacts-list";

export const metadata = { title: "Contacts" };

export default async function ContactsPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const supabase = await createClient();

  // Contacts are first-class V2 records (own id + linked ghl_contact_id). To
  // derive a Lead/Booked status we also pull which contacts a wedding points at.
  const [{ data, error }, { data: weddingRows }] = await Promise.all([
    supabase
      .from("contacts")
      .select(
        "id, first_name, last_name, email, phone, partner_first_name, partner_last_name, wedding_date, guest_count, budget_minor, source, ghl_contact_id, created_at",
      )
      .eq("venue_id", ctx.venue.id)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("weddings")
      .select("contact_id")
      .eq("venue_id", ctx.venue.id)
      .neq("status", "cancelled"),
  ]);

  if (error) console.error("contacts query failed:", error.message);

  const bookedContactIds = new Set(
    (weddingRows ?? []).map((w) => w.contact_id).filter(Boolean),
  );
  const today = new Date().toISOString().slice(0, 10);

  const contacts: ContactRow[] = (data ?? []).map((c) => {
    const booked = bookedContactIds.has(c.id);
    return {
      ...c,
      status: booked ? "booked" : "lead",
      is_upcoming: booked && !!c.wedding_date && c.wedding_date >= today,
    };
  });

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Contacts"
        subtitle={`Everyone in ${ctx.venue.name}'s book — leads and booked couples.`}
      />
      <ContactsList contacts={contacts} />
    </div>
  );
}
