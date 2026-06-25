"use client";

/**
 * Shared conversation UI — used by the contact Messages view, the wedding
 * Messages tab, and the global inbox's detail pane (specs/conversations-module.md, D-C2).
 *
 * Exports:
 *   ChannelIcon, MessageBubble, ReplyComposer, ThreadDetail — primitives.
 *   ConversationsPane — contact-scoped two-pane (one contact, N channel threads).
 *   ConnectPrompt — graceful "no GHL" / "no contact" empty states.
 *
 * Keyed on `ghlContactId` (not weddingId). Thread switching loads history on
 * demand via getThreadMessagesAction; Realtime pings re-fetch. No message is
 * stored in VF2 (D3 — GHL is the record of truth).
 */

import * as React from "react";
import {
  Mail,
  MessageSquare,
  MessageCircle,
  Send,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

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
import {
  sendMessageByContactAction,
  getThreadMessagesAction,
} from "@/app/(app)/conversations/actions";
import type { GhlConversation, GhlMessage, GhlConversationType } from "@/lib/ghl/types";

// ── Channel icon ────────────────────────────────────────────────────────────────

export function ChannelIcon({
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

// ── Message bubble ──────────────────────────────────────────────────────────────

export function MessageBubble({ msg }: { msg: GhlMessage }) {
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

// ── Reply composer ──────────────────────────────────────────────────────────────

export function ReplyComposer({
  ghlContactId,
  recipientName,
  defaultType,
  onSent,
}: {
  ghlContactId: string;
  recipientName: string;
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
      const result = await sendMessageByContactAction({ ghlContactId, type, message: text });
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
        <Select value={type} onValueChange={(v) => setType(v as "SMS" | "Email" | "WhatsApp")}>
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
        placeholder={`Message ${recipientName}…`}
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
        <Button size="sm" onClick={handleSend} disabled={sending || !draft.trim()} className="gap-1.5">
          <Send className="size-3.5" aria-hidden />
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}

// ── Thread detail panel ─────────────────────────────────────────────────────────

export function ThreadDetail({
  ghlContactId,
  recipientName,
  conv,
  messages,
  loading,
  onBack,
  onSent,
}: {
  ghlContactId: string;
  recipientName: string;
  conv: GhlConversation;
  messages: GhlMessage[];
  loading?: boolean;
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
          <h2 className="text-base font-semibold text-foreground">{recipientName}</h2>
          {(conv.unreadCount ?? 0) > 0 && (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-fun-pink-strong text-[10px] font-bold text-white">
              {conv.unreadCount}
            </span>
          )}
        </div>
      </div>

      {/* Messages — scrollable */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-5">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-16 text-muted-foreground">
            <RefreshCw className="size-5 animate-spin" aria-hidden />
          </div>
        ) : messages.length === 0 ? (
          <ThreadEmpty />
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
        ghlContactId={ghlContactId}
        recipientName={recipientName}
        defaultType={conv.type}
        onSent={onSent}
      />
    </div>
  );
}

function ThreadEmpty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <MessageCircle className="size-6" aria-hidden />
      </div>
      <p className="text-sm font-medium text-foreground">No messages in this thread yet</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">Start the conversation below.</p>
    </div>
  );
}

// ── Contact-scoped two-pane (one contact, N channel threads) ─────────────────────

export interface ConversationsPaneProps {
  ghlContactId: string;
  contactName: string;
  /** All channel threads for this contact, fetched server-side. */
  conversations: GhlConversation[];
  initialMessages: GhlMessage[];
  initialConversationId: string | null;
}

export function ConversationsPane({
  ghlContactId,
  contactName,
  conversations,
  initialMessages,
  initialConversationId,
}: ConversationsPaneProps) {
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

  // Realtime: re-fetch the open thread when GHL pings this contact's channel.
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`contact:${ghlContactId}:messages`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "new-message" }, () => {
        if (selectedConv) void loadThread(selectedConv.id);
        toast("New message received.", { duration: 3000 });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ghlContactId, selectedConv, loadThread]);

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
          <p className="text-sm font-medium text-foreground">No conversations found</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            No GHL conversation threads for {contactName} yet. Messages sent or received via GHL
            will appear here.
          </p>
        </div>
      </div>
    );
  }

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
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Threads ({conversations.length})</p>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Refresh"
              aria-label="Refresh messages"
              onClick={() => selectedConv && loadThread(selectedConv.id)}
            >
              <RefreshCw className="size-4 text-muted-foreground" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.map((conv) => (
              <ChannelThreadRow
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
            mobileShowThread ? "flex flex-col" : "hidden md:flex md:flex-col",
          )}
        >
          {selectedConv && (
            <ThreadDetail
              ghlContactId={ghlContactId}
              recipientName={contactName}
              conv={selectedConv}
              messages={messages}
              loading={loading}
              onBack={() => setMobileShowThread(false)}
              onSent={handleSent}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Thread row in the contact pane — labelled by channel type. */
function ChannelThreadRow({
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
          <p className={cn("text-sm leading-tight", unread > 0 ? "font-semibold" : "font-medium")}>
            {conv.type}
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
        {unread > 0 && (
          <span className="mt-1.5 inline-flex size-5 items-center justify-center rounded-full bg-fun-pink-strong text-[10px] font-bold tabular-nums text-white">
            {unread}
          </span>
        )}
      </div>
    </button>
  );
}

// ── Connect / empty prompts ──────────────────────────────────────────────────────

export function ConnectPrompt({ reason }: { reason: "no-ghl" | "no-contact" }) {
  return (
    <div
      className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-border bg-card p-8 text-center"
      data-testid={reason === "no-ghl" ? "messages-no-ghl" : "messages-no-contact"}
    >
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <MessageCircle className="size-6" aria-hidden />
      </div>
      <p className="text-sm font-medium text-foreground">
        {reason === "no-ghl" ? "GHL is not connected" : "No GHL contact linked"}
      </p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        {reason === "no-ghl"
          ? "Connect your GoHighLevel account in Settings to view and send messages here."
          : "This record has no linked GHL contact. Messages will appear here once the contact is connected."}
      </p>
      {reason === "no-ghl" && (
        <a
          href="/settings/ghl"
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Connect GHL
        </a>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────────

export function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) {
      return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    }
    if (diffDays < 7) {
      return d.toLocaleDateString("en-GB", { weekday: "short" });
    }
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}
