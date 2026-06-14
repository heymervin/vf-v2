import { PageHeader } from "@/components/layout/page-header";
import { CONTACTS } from "@/lib/mock";
import { ContactsTableClient } from "./contacts-table-client";

export const metadata = { title: "Contacts — VenueFlow Preview" };

export default function ContactsPreviewPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Contacts"
        subtitle="Every enquiry for The Old Barn, with its current pipeline stage."
      />
      <ContactsTableClient contacts={CONTACTS} />
    </div>
  );
}
