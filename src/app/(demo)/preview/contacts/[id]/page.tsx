import Link from "next/link";
import { Users, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  CONTACTS,
  WEDDINGS,
  getContact,
  getConversation,
  getActivity,
  getNotes,
  getContactTasks,
} from "@/lib/mock";
import { ContactDetailClient } from "./contact-detail-client";

export function generateStaticParams() {
  return CONTACTS.map((c) => ({ id: c.id }));
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = getContact(id);

  if (!contact) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Users className="size-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Contact not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This contact doesn&apos;t exist in the prototype dataset.
          </p>
          <Link
            href="/preview/contacts"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Back to Contacts
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  const messages = getConversation(id);
  const activities = getActivity(id);
  const notes = getNotes(id);
  const tasks = getContactTasks(id);
  const wedding = WEDDINGS.find((w) => w.contactId === id);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title={contact.coupleName}
        shimmer={false}
        actions={
          <Link href="/preview/contacts">
            <Button variant="outline" size="sm">
              All Contacts
            </Button>
          </Link>
        }
      />
      <ContactDetailClient
        contact={contact}
        messages={messages}
        activities={activities}
        notes={notes}
        tasks={tasks}
        wedding={wedding}
        ownerId={contact.ownerId}
      />
    </div>
  );
}
