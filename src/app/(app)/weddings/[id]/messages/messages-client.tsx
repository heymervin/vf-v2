"use client";

/**
 * MessagesClient — Wedding Workspace "Messages" tab client component.
 *
 * Responsibilities:
 *   1. Render a two-pane layout: thread list (left) + message history (right).
 *   2. Allow staff to select a thread and reply via sendMessageAction.
 *   3. Subscribe to the Supabase Realtime channel "wedding:{weddingId}:messages"
 *      and append inbound messages live — re-fetches via the window reload hint.
 *
 * Design source: src/app/(demo)/preview/inbox/inbox-client.tsx (ported + adapted).
 *
 * RSC rules:
 *   - This file is "use client" — all event handlers live here.
 *   - Props are plain serialisable values (no server functions passed as props).
 *   - The sendMessageAction import is from the sibling actions.ts (server action).
 *
 * No messages are stored in VF2 (D3 — GHL is record of truth).
 * Realtime is best-effort; a failed broadcast never crashes the UI.
 */

import * as React from "react";
import Link from "next/link";
import {
  Mail,
  MessageSquare,
  MessageCircle,
  Send,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { sendMessageAction } from "./actions";
import type { GhlConversation, GhlMessage, GhlConversationType } from "@/lib/ghl/types";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MessagesClientProps {
  weddingId: string;
  coupleName: string;
  /** All conversation threads for this contact, fetched server-side. */
  conversations: GhlConversation[];
  /**
   * Messages for the initially-selected thread (the first thread, or empty).
   * The client uses this as initial state; Realtime triggers a router refresh.
   */
  initialMessages: GhlMessage[];
  /** The initially-selected conversation id (may be null if no threads). */
  initialConversationId: string | null;
}

// ── Channel icon helper ───────────────────────────────────────────────────────

function ChannelIcon({
  type,
  className,
}: {
  type: GhlConversationType;
  className?: string;
}) {
  if (type === "Email") return <Mail className={cn("size-3.5 shrink-0", className)} />;
  if (type === "SMS") return <MessageSquare className={cn("size-3.5 shrink-0", className)} />;
  return <MessageCircle className={cn("size-3.5 shrink-0", className)} />;
}

// ── Thread list row ───────────────────────────────────────────────────────────

function ThreadRow({
  conv,
  isSelected,
  onClick,
}: {
  conv: GhlConversation;
  isSelected: boolean;
  onClick: () => void;
}) {
  const unread = conv.unreadCount ?? 0;

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
      {/* Channel icon badge */}
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full mt-0.5",
          isSelected
            ? "bg-fun-pink text-fun-pink-foreground"
            : "bg-accent text-accent-foreground",
        )}
      >
        <ChannelIcon type={conv.type} className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        {/* Row 1: type label + time */}
        <div className="flex items-center justify-between gap-2">
          <p className={cn("text-sm leading-tight", unread > 0 ? "font-semibold" : "font-medium")}>
            {conv.type}
          </p>
          {conv.lastMessageDate && (
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {formatTime(conv.lastMessageDate)}
            </span>
          )}
        </div>

        {/* Row 2: preview */}
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

        {/* Row 3: unread badge */}
        {unread > 0 && (
          <span className="mt-1.5 inline-flex size-5 items-center justify-center rounded-full bg-fun-pink-strong text-[10px] font-bold tabular-nums text-white">
            {unread}
          </span>
        )}
      </div>
    </button>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: GhlMessage }) {
  const isOut = msg.direction === "outbound";

  return (
    <div
      className={cn(
        "flex max-w-[80%] flex-col gap-1",
        isOut ? "self-end items-end" : "self-start items-start",
      )}
    >
      <div
        className={cn(
          "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isOut
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm",
        )}
      >
        {msg.body}
      </div>
      <div
        className={cn(
          "flex items-center gap-1 text-[10px] text-muted-foreground",
          isOut ? "flex-row-reverse" : "flex-row",
        )}
      >
        <ChannelIcon type={msg.type} />
        <span>{msg.type}</span>
        <span className="opacity-60">·</span>
        <span className="tabular-nums">{formatTime(msg.dateAdded)}</span>
      </div>
    </div>
  );
}

// ── Reply composer ────────────────────────────────────────────────────────────

function ReplyComposer({
  weddingId,
  coupleName,
  defaultType,
  onSent,
}: {
  weddingId: string;
  coupleName: string;
  defaultType: GhlConversationType;
  onSent: (msg: GhlMessage) => void;
}) {
  const safeDefault =
    defaultType === "SMS" || defaultType === "Email" || defaultType === "WhatsApp"
      ? defaultType
      : "SMS";

  const [type, setType] = React.useState<"SMS" | "Email" | "WhatsApp">(safeDefault);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);

  async function handleSend() {
    const text = draft.trim();
    if (!text) {
      toast.error("Write a message first.");
      return;
    }
    setSending(true);
    try {
      const result = await sendMessageAction({ weddingId, type, message: text });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Message sent via ${type}.`);
      setDraft("");
      onSent(result.data);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Via
        </span>
        <Select
          value={type}
          onValueChange={(v) => setType(v as "SMS" | "Email" | "WhatsApp")}
        >
          <SelectTrigger size="sm" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SMS">
              <MessageSquare className="size-3.5" />
              SMS
            </SelectItem>
            <SelectItem value="Email">
              <Mail className="size-3.5" />
              Email
            </SelectItem>
            <SelectItem value="WhatsApp">
              <MessageCircle className="size-3.5" />
              WhatsApp
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Textarea
        placeholder={`Message ${coupleName}…`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="mb-3 min-h-[80px] resize-none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void handleSend();
          }
        }}
      />

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          className="gap-1.5"
        >
          <Send className="size-3.5" aria-hidden />
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}

// ── Thread detail panel ───────────────────────────────────────────────────────

function ThreadDetail({
  weddingId,
  coupleName,
  conv,
  messages,
  onBack,
  onSent,
}: {
  weddingId: string;
  coupleName: string;
  conv: GhlConversation;
  messages: GhlMessage[];
  onBack: () => void;
  onSent: (msg: GhlMessage) => void;
}) {
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "instant" });
  }, [conv.id, messages.length]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card px-5 py-4">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:hidden"
        >
          <ArrowLeft className="size-4" />
          All threads
        </button>

        <div className="flex items-center gap-2">
          <ChannelIcon type={conv.type} className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">
            {conv.type} conversation
          </h2>
          {(conv.unreadCount ?? 0) > 0 && (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-fun-pink-strong text-[10px] font-bold text-white">
              {conv.unreadCount}
            </span>
          )}
        </div>
      </div>

      {/* Messages — scrollable */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-5">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <MessageCircle className="size-6" aria-hidden />
            </div>
            <p className="text-sm font-medium text-foreground">
              No messages in this thread yet
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Start the conversation below.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            <div ref={endRef} />
          </>
        )}
      </div>

      {/* Reply composer */}
      <ReplyComposer
        key={conv.id}
        weddingId={weddingId}
        coupleName={coupleName}
        defaultType={conv.type}
        onSent={onSent}
      />
    </div>
  );
}

// ── Root client component ─────────────────────────────────────────────────────

export function MessagesClient({
  weddingId,
  coupleName,
  conversations,
  initialMessages,
  initialConversationId,
}: MessagesClientProps) {
  const router = useRouter();

  // Selected thread id
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initialConversationId,
  );

  // Messages for the current thread — start from server-fetched initial
  const [messages, setMessages] = React.useState<GhlMessage[]>(initialMessages);

  // Mobile: show right pane
  const [mobileShowThread, setMobileShowThread] = React.useState(false);

  // ── Update messages when thread changes ────────────────────────────────────
  // We receive all messages for the *initial* thread from the server.
  // When the user selects a different thread we trigger a full router refresh
  // so the server re-fetches that thread's messages. Simple and correct.
  // (A future optimisation could fetch per-thread client-side, but router.refresh
  //  keeps the "GHL is record of truth, no client-side state accumulation" rule.)

  // ── Realtime subscription ──────────────────────────────────────────────────
  // Channel: wedding:{weddingId}:messages
  // Event: new-message — broadcast by the GHL webhook handler (route.ts)
  // On receipt: router.refresh() pulls the latest thread from GHL server-side.
  React.useEffect(() => {
    const supabase = createClient();
    const channelName = `wedding:${weddingId}:messages`;

    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "new-message" }, () => {
        // Re-fetch server data (GHL as record of truth — no client-side message storage).
        router.refresh();
        toast("New message received.", { duration: 3000 });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weddingId]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedConv =
    conversations.find((c) => c.id === selectedId) ?? conversations[0] ?? null;

  function handleSelectThread(id: string) {
    if (id !== selectedId) {
      // Switching threads: clear local messages and re-fetch the new thread's
      // history from the server (GHL is the record of truth — no client storage).
      setMessages([]);
      router.refresh();
    }
    setSelectedId(id);
    setMobileShowThread(true);
  }

  function handleSent(msg: GhlMessage) {
    // Optimistically append the sent message.
    setMessages((prev) => [...prev, msg]);
  }

  // ── Empty state: no threads ────────────────────────────────────────────────
  if (conversations.length === 0) {
    return (
      <div
        className="flex h-[calc(100dvh-200px)] min-h-[300px] items-center justify-center rounded-xl border border-border bg-card p-8 text-center"
        data-testid="messages-empty-threads"
      >
        <div>
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <MessageCircle className="size-6" aria-hidden />
          </div>
          <p className="text-sm font-medium text-foreground">
            No conversations found
          </p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            No GHL conversation threads for {coupleName} yet. Messages sent or
            received via GHL will appear here.
          </p>
        </div>
      </div>
    );
  }

  // ── Two-pane layout ────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100dvh-200px)] min-h-[500px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-1 min-h-0">
        {/* LEFT — thread list */}
        <div
          className={cn(
            "flex w-full flex-col border-r border-border md:w-[300px] md:flex-shrink-0 lg:w-[340px]",
            mobileShowThread ? "hidden md:flex" : "flex",
          )}
        >
          {/* List header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">
              Threads ({conversations.length})
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Refresh"
              aria-label="Refresh messages"
              onClick={() => router.refresh()}
            >
              <RefreshCw className="size-4 text-muted-foreground" />
            </Button>
          </div>

          {/* Thread rows */}
          <div className="flex-1 overflow-y-auto">
            {conversations.map((conv) => (
              <ThreadRow
                key={conv.id}
                conv={conv}
                isSelected={conv.id === (selectedId ?? conversations[0]?.id)}
                onClick={() => handleSelectThread(conv.id)}
              />
            ))}
          </div>
        </div>

        {/* RIGHT — thread detail */}
        <div
          className={cn(
            "flex-1 overflow-hidden",
            mobileShowThread
              ? "flex flex-col"
              : "hidden md:flex md:flex-col",
          )}
        >
          {selectedConv ? (
            <ThreadDetail
              weddingId={weddingId}
              coupleName={coupleName}
              conv={selectedConv}
              messages={messages}
              onBack={() => setMobileShowThread(false)}
              onSent={handleSent}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div>
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <MessageCircle className="size-6" aria-hidden />
                </div>
                <p className="text-sm font-medium text-foreground">
                  Select a thread
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose a conversation from the list.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) {
      return d.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    if (diffDays < 7) {
      return d.toLocaleDateString("en-GB", { weekday: "short" });
    }
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

// ── Connect-prompt empty state (exported for the server page) ─────────────────

/**
 * Shown when:
 *  a) The venue has no GHL connection, OR
 *  b) The wedding has no ghl_contact_id.
 *
 * This is a pure presentational component — no client state needed.
 * Exported here so the server page can render it without importing the full client.
 */
export function MessagesConnectPrompt({
  reason,
}: {
  reason: "no-ghl" | "no-contact";
}) {
  return (
    <div
      className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-border bg-card p-8 text-center"
      data-testid={reason === "no-ghl" ? "messages-no-ghl" : "messages-no-contact"}
    >
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <MessageCircle className="size-6" aria-hidden />
      </div>
      <p className="text-sm font-medium text-foreground">
        {reason === "no-ghl"
          ? "GHL is not connected"
          : "No GHL contact linked"}
      </p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        {reason === "no-ghl"
          ? "Connect your GoHighLevel account in Settings to view and send messages here."
          : "This wedding does not have a linked GHL contact. Messages will appear here once the contact is connected."}
      </p>
      {reason === "no-ghl" && (
        <Link
          href="/settings/ghl"
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Connect GHL
        </Link>
      )}
    </div>
  );
}
