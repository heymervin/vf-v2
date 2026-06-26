/**
 * Contact Messages — a single contact's GHL conversation threads.
 *
 * Server page (specs/conversations-module.md):
 *   1. Auth → redirect if unauthenticated.
 *   2. Load contact scoped to venue → 404 if missing.
 *   3. Resolve ghlClient(venue) → connect prompt if not connected.
 *   4. No ghl_contact_id → "no contact linked" prompt.
 *   5. listConversations({ contactId }) + first thread's messages → ConversationsPane.
 *
 * No message data is stored in VF2 (D3). Mirrors the wedding Messages tab via the
 * same shared ConversationsPane (D-C2).
 */

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { ghlClient } from "@/lib/ghl/client";
import { PageHeader } from "@/components/layout/page-header";
import { ConversationsPane, ConnectPrompt } from "@/components/conversations/thread-view";
import { contactDisplayName } from "../../format";

export const metadata = { title: "Messages" };

export default async function ContactMessagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const supabase = await createClient();
  const { data: contact, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, ghl_contact_id")
    .eq("id", id)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (error) console.error("[contacts/messages] contact load error:", error.message);
  if (!contact) notFound();

  const name = contactDisplayName(contact);

  const client = await ghlClient(ctx.venue.id);

  if (!client) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <Header contactId={id} name={name} />
        <ConnectPrompt reason="no-ghl" />
      </div>
    );
  }

  if (!contact.ghl_contact_id) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <Header contactId={id} name={name} />
        <ConnectPrompt reason="no-contact" />
      </div>
    );
  }

  let conversations = await client
    .listConversations({ contactId: contact.ghl_contact_id })
    .catch((e: unknown) => {
      console.error("[contacts/messages] listConversations error:", e);
      return [];
    });

  conversations = conversations.slice().sort((a, b) => {
    const aTime = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0;
    const bTime = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0;
    return bTime - aTime;
  });

  const firstConv = conversations[0] ?? null;
  const initialMessages = firstConv
    ? await client.getMessages(firstConv.id).catch((e: unknown) => {
        console.error("[contacts/messages] getMessages error:", e);
        return [];
      })
    : [];

  return (
    <div className="mx-auto max-w-[1400px]">
      <Header contactId={id} name={name} />
      <ConversationsPane
        ghlContactId={contact.ghl_contact_id}
        contactName={name}
        conversations={conversations}
        initialMessages={initialMessages}
        initialConversationId={firstConv?.id ?? null}
      />
    </div>
  );
}

function Header({ contactId, name }: { contactId: string; name: string }) {
  return (
    <div className="mb-2">
      <Link
        href={`/contacts/${contactId}`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to {name}
      </Link>
      <PageHeader title="Messages" subtitle={`Conversations with ${name} — read, reply, and receive live.`} />
    </div>
  );
}
