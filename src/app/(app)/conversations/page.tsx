/**
 * Inbox — every conversation thread in the venue's GHL location.
 *
 * Server page (specs/conversations-module.md):
 *   1. Auth → redirect if unauthenticated.
 *   2. Resolve ghlClient(venue) → connect prompt if not connected.
 *   3. searchConversations({ status }) — `?filter=unread` (default) | `all` (D-C1).
 *   4. Build ghl_contact_id → V2 contact id map for deep-linking (D-C3).
 *   5. Pre-fetch the first thread's messages, render InboxClient.
 *
 * No message data is stored in VF2 (D3).
 */

import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { ghlClient } from "@/lib/ghl/client";
import { PageHeader } from "@/components/layout/page-header";
import { InboxClient } from "@/components/conversations/inbox-client";
import { ConnectPrompt } from "@/components/conversations/thread-view";

export const metadata = { title: "Inbox" };

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const { filter: filterParam } = await searchParams;
  const filter: "unread" | "all" = filterParam === "all" ? "all" : "unread";

  const client = await ghlClient(ctx.venue.id);

  if (!client) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <PageHeader title="Inbox" subtitle="All your GHL conversations in one place." />
        <ConnectPrompt reason="no-ghl" />
      </div>
    );
  }

  // Fetch threads (best-effort — never crash the page).
  const conversations = await client
    .searchConversations({ status: filter })
    .catch((e: unknown) => {
      console.error("[conversations/page] searchConversations error:", e);
      return [];
    });

  // Build ghl_contact_id → V2 contact id map for the venue (deep-link matched rows).
  const supabase = await createClient();
  const { data: contactRows } = await supabase
    .from("contacts")
    .select("id, ghl_contact_id")
    .eq("venue_id", ctx.venue.id)
    .not("ghl_contact_id", "is", null);

  const contactLinks: Record<string, string> = {};
  for (const row of contactRows ?? []) {
    if (row.ghl_contact_id) contactLinks[row.ghl_contact_id] = row.id;
  }

  const firstConv = conversations[0] ?? null;
  const initialMessages = firstConv
    ? await client.getMessages(firstConv.id).catch((e: unknown) => {
        console.error("[conversations/page] getMessages error:", e);
        return [];
      })
    : [];

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Inbox"
        subtitle="All your GHL conversations — read, reply, and triage in one place."
      />
      <InboxClient
        conversations={conversations}
        initialMessages={initialMessages}
        initialConversationId={firstConv?.id ?? null}
        contactLinks={contactLinks}
        filter={filter}
        venueId={ctx.venue.id}
      />
    </div>
  );
}
