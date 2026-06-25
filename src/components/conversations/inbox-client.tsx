"use client";

/**
 * Global inbox client (specs/conversations-module.md).
 *
 * Left: every thread in the venue's GHL location (contact-labelled rows),
 *       unread/all toggle. Right: the selected thread + composer (shared
 *       ThreadDetail). Matched contacts (a V2 contacts row exists) deep-link to
 *       /contacts/[id]; unmatched threads open inline with a "not in VenueFlow"
 *       tag (D-C3). No message is stored in VF2 (D3).
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getThreadMessagesAction } from "@/app/(app)/conversations/actions";
import {
  ChannelIcon,
  ThreadDetail,
  formatTime,
} from "@/components/conversations/thread-view";
import type { GhlInboxConversation, GhlMessage } from "@/lib/ghl/types";

export interface InboxClientProps {
  conversations: GhlInboxConversation[];
  initialMessages: GhlMessage[];
  initialConversationId: string | null;
  /** ghl_contact_id → V2 contact id, for deep-linking matched rows. */
  contactLinks: Record<string, string>;
  filter: "unread" | "all";
  venueId: string;
}

export function InboxClient({
  conversations,
  initialMessages,
  initialConversationId,
  contactLinks,
  filter,
  venueId,
}: InboxClientProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = React.useState<string | null>(initialConversationId);
  const [messages, setMessages] = React.useState<GhlMessage[]>(initialMessages);
  const [loading, setLoading] = React.useState(false);
  const [mobileShowThread, setMobileShowThread] = React.useState(false);

  const selectedConv =
    conversations.find((c) => c.id === selectedId) ?? conversations[0] ?? null;

  const loadThread = React.useCallback(async (conversationId: string) => {
    setLoading(true);
    try {
      const result = await getThreadMessagesAction({ conversationId });
      setMessages(result.ok ? result.data : []);
      if (!result.ok) toast.error(result.error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Realtime: a venue-wide ping when any inbound message arrives. We reload the
  // open thread if it's the affected contact; the list itself refreshes on the
  // manual button (ponytail: avoid a jarring full re-render on every ping).
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`venue:${venueId}:inbox`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "new-message" }, (payload) => {
        const contactId = (payload?.payload as { contactId?: string } | undefined)?.contactId;
        if (contactId && selectedConv?.contactId === contactId) {
          void loadThread(selectedConv.id);
        }
        toast("New message received.", { duration: 3000 });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [venueId, selectedConv, loadThread]);

  function handleSelectThread(id: string) {
    if (id !== selectedId) {
      setSelectedId(id);
      void loadThread(id);
    }
    setMobileShowThread(true);
  }

  function handleSent(msg: GhlMessage) {
    setMessages((prev) => [...prev, msg]);
  }

  return (
    <div className="flex h-[calc(100dvh-200px)] min-h-[500px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-1 min-h-0">
        {/* LEFT — thread list */}
        <div
          className={cn(
            "flex w-full flex-col border-r border-border md:w-[320px] md:flex-shrink-0 lg:w-[360px]",
            mobileShowThread ? "hidden md:flex" : "flex",
          )}
        >
          {/* Header: unread/all toggle + refresh */}
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="inline-flex rounded-md border border-border p-0.5">
              <FilterTab label="Unread" href="/conversations?filter=unread" active={filter === "unread"} />
              <FilterTab label="All" href="/conversations?filter=all" active={filter === "all"} />
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Refresh"
              aria-label="Refresh inbox"
              onClick={() => router.refresh()}
            >
              <RefreshCw className="size-4 text-muted-foreground" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <MessageCircle className="size-6" aria-hidden />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {filter === "unread" ? "You're all caught up" : "No conversations yet"}
                </p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  {filter === "unread"
                    ? "No unread threads. Switch to All to see every conversation."
                    : "Messages sent or received via GHL will appear here."}
                </p>
              </div>
            ) : (
              conversations.map((conv) => (
                <InboxRow
                  key={conv.id}
                  conv={conv}
                  isSelected={conv.id === (selectedId ?? conversations[0]?.id)}
                  v2ContactId={contactLinks[conv.contactId] ?? null}
                  onClick={() => handleSelectThread(conv.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* RIGHT — thread detail */}
        <div
          className={cn(
            "flex-1 overflow-hidden",
            mobileShowThread ? "flex flex-col" : "hidden md:flex md:flex-col",
          )}
        >
          {selectedConv ? (
            <ThreadDetail
              ghlContactId={selectedConv.contactId}
              recipientName={selectedConv.contactName ?? "Unknown contact"}
              conv={selectedConv}
              messages={messages}
              loading={loading}
              onBack={() => setMobileShowThread(false)}
              onSent={handleSent}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div>
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <MessageCircle className="size-6" aria-hidden />
                </div>
                <p className="text-sm font-medium text-foreground">Select a conversation</p>
                <p className="mt-1 text-xs text-muted-foreground">Choose a thread from the list.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Filter toggle tab ────────────────────────────────────────────────────────────

function FilterTab({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded px-3 py-1 text-xs font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
      aria-current={active ? "true" : undefined}
    >
      {label}
    </Link>
  );
}

// ── Inbox row (a contact's thread) ───────────────────────────────────────────────

function InboxRow({
  conv,
  isSelected,
  v2ContactId,
  onClick,
}: {
  conv: GhlInboxConversation;
  isSelected: boolean;
  v2ContactId: string | null;
  onClick: () => void;
}) {
  const unread = conv.unreadCount ?? 0;
  const name = conv.contactName ?? "Unknown contact";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full min-h-[72px] items-start gap-3 border-b border-border px-4 py-3.5 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        isSelected
          ? "border-l-2 border-l-fun-pink-strong bg-accent/70"
          : "border-l-2 border-l-transparent hover:bg-accent/40",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full mt-0.5",
          isSelected ? "bg-fun-pink text-fun-pink-foreground" : "bg-accent text-accent-foreground",
        )}
      >
        <ChannelIcon type={conv.type} className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={cn("truncate text-sm leading-tight", unread > 0 ? "font-semibold" : "font-medium")}>
            {name}
          </p>
          {conv.lastMessageDate && (
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {formatTime(conv.lastMessageDate)}
            </span>
          )}
        </div>

        {conv.lastMessageBody && (
          <p
            className={cn(
              "mt-0.5 truncate text-xs",
              unread > 0 ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {conv.lastMessageBody}
          </p>
        )}

        <div className="mt-1.5 flex items-center gap-2">
          {unread > 0 && (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-fun-pink-strong text-[10px] font-bold tabular-nums text-white">
              {unread}
            </span>
          )}
          {v2ContactId ? (
            <Link
              href={`/contacts/${v2ContactId}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-3" />
              View contact
            </Link>
          ) : (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              Not in VenueFlow
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
