"use client";

import * as React from "react";
import { ArrowLeft, Mail, MessageSquare, MessageCircle, Sparkles, Send } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StageBadge } from "@/components/stage-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  Contact,
  Message,
  Channel,
  LeadScore,
} from "@/lib/mock";
import { CHANNEL_LABEL, formatLongDate, formatMessageTime } from "@/lib/mock";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConversationItem extends Contact {
  thread: Message[];
}

interface InboxClientProps {
  conversations: ConversationItem[];
}

// ---------------------------------------------------------------------------
// Channel icon map
// ---------------------------------------------------------------------------

function ChannelIcon({
  channel,
  className,
}: {
  channel: Channel;
  className?: string;
}) {
  if (channel === "email")
    return <Mail className={cn("size-3.5 shrink-0", className)} />;
  if (channel === "sms")
    return <MessageSquare className={cn("size-3.5 shrink-0", className)} />;
  // whatsapp
  return <MessageCircle className={cn("size-3.5 shrink-0", className)} />;
}

// ---------------------------------------------------------------------------
// Lead score chip
// ---------------------------------------------------------------------------

const SCORE_CLASSES: Record<LeadScore, string> = {
  hot: "bg-fun-pink text-fun-pink-foreground border-transparent",
  warm: "bg-warning text-warning-foreground border-transparent",
  cold: "bg-muted text-muted-foreground border-transparent",
};

const SCORE_LABEL: Record<LeadScore, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
};

function ScoreChip({ score }: { score: LeadScore }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-px text-[10px] font-semibold uppercase tracking-[0.06em]",
        SCORE_CLASSES[score],
      )}
    >
      {SCORE_LABEL[score]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Conversation list row
// ---------------------------------------------------------------------------

function ConversationRow({
  item,
  isSelected,
  onClick,
}: {
  item: ConversationItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full min-h-[72px] text-left px-4 py-3.5 flex items-start gap-3 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        isSelected
          ? "bg-accent/70 border-l-2 border-l-fun-pink-strong"
          : "border-l-2 border-l-transparent hover:bg-accent/40",
      )}
    >
      {/* Avatar */}
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          isSelected
            ? "bg-fun-pink text-fun-pink-foreground"
            : "bg-accent text-accent-foreground",
        )}
      >
        {item.initials}
      </span>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        {/* Row 1: name + time */}
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "truncate text-sm leading-tight",
              item.unread > 0
                ? "font-semibold text-foreground"
                : "font-medium text-foreground",
            )}
          >
            {item.coupleName}
          </p>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {formatMessageTime(item.lastMessageAt)}
          </span>
        </div>

        {/* Row 2: channel icon + preview */}
        <div className="mt-0.5 flex items-center gap-1.5">
          <ChannelIcon
            channel={item.lastChannel}
            className="text-muted-foreground"
          />
          <p
            className={cn(
              "truncate text-xs",
              item.unread > 0
                ? "text-foreground"
                : "text-muted-foreground",
            )}
          >
            {item.lastMessagePreview}
          </p>
        </div>

        {/* Row 3: score chip + unread dot */}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <ScoreChip score={item.score} />
          {item.unread > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-fun-pink-strong text-[10px] font-bold tabular-nums text-white">
              {item.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Thread view — message bubbles
// ---------------------------------------------------------------------------

function MessageBubble({ msg }: { msg: Message }) {
  const isOut = msg.direction === "out";

  return (
    <div
      className={cn(
        "flex flex-col max-w-[80%] gap-1",
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

      {/* Channel tag + timestamp */}
      <div
        className={cn(
          "flex items-center gap-1 text-[10px] text-muted-foreground",
          isOut ? "flex-row-reverse" : "flex-row",
        )}
      >
        <ChannelIcon channel={msg.channel} className="text-muted-foreground" />
        <span>{CHANNEL_LABEL[msg.channel]}</span>
        <span className="opacity-60">·</span>
        <span className="tabular-nums">{formatMessageTime(msg.at)}</span>
        {!isOut && (
          <>
            <span className="opacity-60">·</span>
            <span>{msg.author}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thread composer
// ---------------------------------------------------------------------------

function ThreadComposer({ coupleName }: { coupleName: string }) {
  const [channel, setChannel] = React.useState<Channel>("email");
  const [draft, setDraft] = React.useState("");

  function handleSend() {
    if (!draft.trim()) {
      toast.error("Write a message first.");
      return;
    }
    toast.success(`Message sent to ${coupleName} via ${CHANNEL_LABEL[channel]}.`);
    setDraft("");
  }

  function handleAiDraft() {
    toast("AI draft coming soon — this is a visual prototype.");
  }

  return (
    <div className="border-t border-border bg-card p-4">
      {/* Channel selector */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Via
        </span>
        <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email">
              <Mail className="size-3.5" />
              Email
            </SelectItem>
            <SelectItem value="sms">
              <MessageSquare className="size-3.5" />
              SMS
            </SelectItem>
            <SelectItem value="whatsapp">
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
            handleSend();
          }
        }}
      />

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAiDraft}
          className="gap-1.5 text-xs"
        >
          <Sparkles className="size-3.5 text-fun-pink-strong" />
          AI draft reply
        </Button>

        <Button size="sm" onClick={handleSend} className="gap-1.5">
          <Send className="size-3.5" />
          Send
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thread detail panel
// ---------------------------------------------------------------------------

function ThreadDetail({
  item,
  onBack,
}: {
  item: ConversationItem;
  onBack: () => void;
}) {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Scroll to bottom on open / message change
  React.useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [item.id]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card px-5 py-4">
        {/* Back button — mobile only */}
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:hidden"
        >
          <ArrowLeft className="size-4" />
          All conversations
        </button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          {/* Couple name + quick facts */}
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-fun-pink text-xs font-semibold text-fun-pink-foreground">
                {item.initials}
              </span>
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                {item.coupleName}
              </h2>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {item.weddingDate && (
                <span className="tabular-nums">
                  Wedding: {formatLongDate(item.weddingDate)}
                </span>
              )}
              {item.guestCount && (
                <span className="tabular-nums">{item.guestCount} guests</span>
              )}
            </div>
          </div>

          {/* Stage badge + score */}
          <div className="flex flex-wrap items-center gap-2">
            <StageBadge stage={item.stage} />
            <ScoreChip score={item.score} />
          </div>
        </div>
      </div>

      {/* Message bubbles — scrollable */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-5">
        {item.thread.length === 0 ? (
          <EmptyThread coupleName={item.coupleName} />
        ) : (
          <>
            {item.thread.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Composer */}
      <ThreadComposer coupleName={item.coupleName} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty thread state
// ---------------------------------------------------------------------------

function EmptyThread({ coupleName }: { coupleName: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <MessageCircle className="size-6" />
      </div>
      <p className="text-sm font-medium text-foreground">
        No messages yet with {coupleName}
      </p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        Start the conversation below — choose Email, SMS or WhatsApp.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty list state
// ---------------------------------------------------------------------------

function EmptyList() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Mail className="size-6" />
      </div>
      <p className="text-sm font-medium text-foreground">No conversations yet</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        Conversations appear here as soon as a couple gets in touch via Email,
        SMS or WhatsApp.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root client component
// ---------------------------------------------------------------------------

export function InboxClient({ conversations }: InboxClientProps) {
  const [selectedId, setSelectedId] = React.useState<string>(
    conversations[0]?.id ?? "",
  );
  // On mobile, show list (false) or thread (true)
  const [mobileShowThread, setMobileShowThread] = React.useState(false);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  function selectConversation(id: string) {
    setSelectedId(id);
    setMobileShowThread(true);
  }

  function handleBack() {
    setMobileShowThread(false);
  }

  return (
    <div className="flex h-[calc(100dvh-140px)] min-h-[500px] overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* LEFT — conversation list */}
      <div
        className={cn(
          "flex w-full flex-col border-r border-border md:w-[320px] md:flex-shrink-0 lg:w-[360px]",
          // Mobile: hide list when thread is open
          mobileShowThread ? "hidden md:flex" : "flex",
        )}
      >
        {/* List header */}
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Conversations
            </h2>
            <Badge variant="secondary" className="tabular-nums">
              {conversations.length}
            </Badge>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Email · SMS · WhatsApp — unified
          </p>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {conversations.length === 0 ? (
            <EmptyList />
          ) : (
            conversations.map((item) => (
              <ConversationRow
                key={item.id}
                item={item}
                isSelected={item.id === selectedId}
                onClick={() => selectConversation(item.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* RIGHT — thread detail */}
      <div
        className={cn(
          "flex-1 overflow-hidden",
          // Mobile: show thread only when selected
          mobileShowThread ? "flex flex-col" : "hidden md:flex md:flex-col",
        )}
      >
        {selected ? (
          <ThreadDetail item={selected} onBack={handleBack} />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <MessageCircle className="size-6" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Select a conversation
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose a couple from the list to view their thread.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
