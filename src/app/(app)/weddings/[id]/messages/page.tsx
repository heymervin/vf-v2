/**
 * Messages tab — Wedding Workspace (Slice 6, Integration Point 3).
 *
 * Server page:
 *   1. getTenantContext() → redirect if unauthenticated.
 *   2. Load wedding scoped to venue → 404 if missing.
 *   3. Resolve ghl_contact_id.
 *      - No GHL connection (ghlClient returns null) → graceful connect prompt.
 *      - No ghl_contact_id on the wedding → graceful "no contact linked" prompt.
 *   4. Fetch threads via GHL API (listConversations) + messages for the first thread.
 *   5. Pass to MessagesClient for rendering + Realtime subscription.
 *
 * GHL data path (spec §7.1):
 *   GET /conversations/search?locationId=&contactId=  → threads
 *   GET /conversations/{id}/messages                   → message history
 *
 * No message data is stored in VF2 (D3).
 *
 * RSC safety: MessagesClient is "use client". This page is server-only.
 * No function props are passed down (router.refresh() is client-side).
 */

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { ghlClient } from "@/lib/ghl/client";
import { PageHeader } from "@/components/layout/page-header";
import { MessagesClient, MessagesConnectPrompt } from "./messages-client";

// ── Metadata ──────────────────────────────────────────────────────────────────

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
  return {
    title: data ? `Messages — ${data.couple_names}` : "Messages",
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MessagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const supabase = await createClient();

  // Load the wedding scoped to the current venue.
  const { data: wedding, error: weddingError } = await supabase
    .from("weddings")
    .select("id, couple_names, ghl_contact_id")
    .eq("id", id)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (weddingError) {
    console.error("[messages/page] wedding load error:", weddingError.message);
  }
  if (!wedding) notFound();

  const coupleName = wedding.couple_names;
  const ghlContactId = wedding.ghl_contact_id;

  // Resolve GHL client — null means standalone mode / not connected.
  const client = await ghlClient(ctx.venue.id);

  if (!client) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <MessagesPageHeader weddingId={id} coupleName={coupleName} />
        <MessagesConnectPrompt reason="no-ghl" />
      </div>
    );
  }

  if (!ghlContactId) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <MessagesPageHeader weddingId={id} coupleName={coupleName} />
        <MessagesConnectPrompt reason="no-contact" />
      </div>
    );
  }

  // Fetch threads + messages for the first thread (best-effort; never crash).
  let conversations = await client
    .listConversations({ contactId: ghlContactId })
    .catch((e: unknown) => {
      console.error("[messages/page] listConversations error:", e);
      return [];
    });

  // Sort threads by most recent message (descending).
  conversations = conversations.slice().sort((a, b) => {
    const aTime = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0;
    const bTime = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0;
    return bTime - aTime;
  });

  const firstConv = conversations[0] ?? null;
  const initialMessages = firstConv
    ? await client.getMessages(firstConv.id).catch((e: unknown) => {
        console.error("[messages/page] getMessages error:", e);
        return [];
      })
    : [];

  return (
    <div className="mx-auto max-w-[1400px]">
      <MessagesPageHeader weddingId={id} coupleName={coupleName} />
      <MessagesClient
        weddingId={id}
        coupleName={coupleName}
        conversations={conversations}
        initialMessages={initialMessages}
        initialConversationId={firstConv?.id ?? null}
      />
    </div>
  );
}

// ── Shared page header ────────────────────────────────────────────────────────

function MessagesPageHeader({
  weddingId,
  coupleName,
}: {
  weddingId: string;
  coupleName: string;
}) {
  return (
    <div className="mb-2">
      <Link
        href={`/weddings/${weddingId}`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to {coupleName}
      </Link>
      <PageHeader
        title="Messages"
        subtitle={`GHL conversations for ${coupleName} — read, reply, and receive live.`}
      />
    </div>
  );
}
