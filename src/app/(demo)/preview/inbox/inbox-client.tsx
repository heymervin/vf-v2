"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  MessageSquare,
  MessageCircle,
  Send,
  Clock,
  CheckCheck,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StageBadge } from "@/components/stage-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { DataToolbar } from "@/components/data-toolbar";
import { SmartListBar } from "@/components/smart-list-bar";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { AssigneePopover } from "@/components/assignee-popover";

import type { Contact, Message, Channel, LeadScore } from "@/lib/mock";
import {
  CHANNEL_LABEL,
  TEAM,
  REPLY_TEMPLATES,
  formatLongDate,
  formatMessageTime,
  gbp,
} from "@/lib/mock";

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
// Conversation list row — with hover actions
// ---------------------------------------------------------------------------

function ConversationRow({
  item,
  isSelected,
  isRead,
  ownerId,
  onClick,
  onMarkRead,
  onSnooze,
  onAssign,
}: {
  item: ConversationItem;
  isSelected: boolean;
  isRead: boolean;
  ownerId: string;
  onClick: () => void;
  onMarkRead: () => void;
  onSnooze: () => void;
  onAssign: (id: string) => void;
}) {
  const [showActions, setShowActions] = React.useState(false);
  const unreadCount = isRead ? 0 : item.unread;

  return (
    <div
      className={cn(
        "group relative flex w-full min-h-[72px] border-b border-border",
        isSelected
          ? "bg-accent/70 border-l-2 border-l-fun-pink-strong"
          : "border-l-2 border-l-transparent",
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Main clickable area */}
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex-1 min-w-0 text-left px-4 py-3.5 flex items-start gap-3 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          !isSelected && "hover:bg-accent/40",
        )}
      >
        {/* Avatar */}
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold mt-0.5",
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
                unreadCount > 0
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
                unreadCount > 0
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
            {unreadCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-fun-pink-strong text-[10px] font-bold tabular-nums text-white">
                {unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Hover action tray — floats over the right edge */}
      {showActions && (
        <div
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 z-10",
            "flex items-center gap-0.5 rounded-lg border border-border bg-card shadow-md px-1 py-0.5",
          )}
          // Prevent the tray from dismissing when clicking inside it
          onMouseEnter={() => setShowActions(true)}
        >
          {/* Assign */}
          <AssigneePopover
            team={TEAM}
            currentOwnerId={ownerId}
            onAssign={onAssign}
          />

          {/* Snooze */}
          <Button
            variant="ghost"
            size="icon-sm"
            title="Snooze for 1 day"
            aria-label="Snooze conversation"
            onClick={(e) => {
              e.stopPropagation();
              onSnooze();
            }}
          >
            <Clock className="size-4 text-muted-foreground" />
          </Button>

          {/* Mark read / unread */}
          <Button
            variant="ghost"
            size="icon-sm"
            title={unreadCount > 0 ? "Mark as read" : "Mark as unread"}
            aria-label={unreadCount > 0 ? "Mark as read" : "Mark as unread"}
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead();
            }}
          >
            <CheckCheck
              className={cn(
                "size-4",
                unreadCount > 0
                  ? "text-fun-pink-strong"
                  : "text-muted-foreground",
              )}
            />
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message bubble
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
// Quick reply templates popover
// ---------------------------------------------------------------------------

function TemplatesPopover({
  coupleName,
  activeChannel,
  onInsert,
}: {
  coupleName: string;
  activeChannel: Channel;
  onInsert: (body: string) => void;
}) {
  const [open, setOpen] = React.useState(false);

  // Filter to templates that match the active channel or "any"
  const applicable = REPLY_TEMPLATES.filter(
    (t) => t.channel === "any" || t.channel === activeChannel,
  );

  function handleInsert(body: string) {
    const resolved = body.replace(/\{\{coupleName\}\}/g, coupleName);
    onInsert(resolved);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          aria-label="Insert reply template"
        >
          Templates
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-80 p-1.5"
      >
        <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Quick replies · {CHANNEL_LABEL[activeChannel]}
        </p>

        {applicable.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            No templates for {CHANNEL_LABEL[activeChannel]}.
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {applicable.map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => handleInsert(tmpl.body)}
                className={cn(
                  "flex min-h-[44px] w-full flex-col items-start gap-0.5 rounded-lg px-2 py-2 text-left",
                  "transition-colors hover:bg-muted",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <span className="text-sm font-medium text-foreground">
                  {tmpl.label}
                </span>
                <span className="line-clamp-2 text-xs text-muted-foreground">
                  {tmpl.body.replace(/\{\{coupleName\}\}/g, coupleName)}
                </span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Thread composer — with templates + default channel from lastChannel
// ---------------------------------------------------------------------------

function ThreadComposer({
  item,
}: {
  item: ConversationItem;
}) {
  // Default to the contact's last-used channel
  const [channel, setChannel] = React.useState<Channel>(item.lastChannel);
  const [draft, setDraft] = React.useState("");

  function handleSend() {
    if (!draft.trim()) {
      toast.error("Write a message first.");
      return;
    }
    toast.success(
      `Message sent to ${item.coupleName} via ${CHANNEL_LABEL[channel]}.`,
    );
    setDraft("");
  }

  return (
    <div className="border-t border-border bg-card p-4">
      {/* Channel selector */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Via
        </span>
        <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
          <SelectTrigger size="sm" className="w-34">
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
        placeholder={`Message ${item.coupleName}…`}
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
        <TemplatesPopover
          coupleName={item.coupleName}
          activeChannel={channel}
          onInsert={(body) => setDraft(body)}
        />

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
  ownerId,
  onBack,
  onAssign,
}: {
  item: ConversationItem;
  ownerId: string;
  onBack: () => void;
  onAssign: (id: string) => void;
}) {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const assignee = TEAM.find((m) => m.id === ownerId);

  React.useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [item.id]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card px-5 py-4">
        {/* Back — mobile only */}
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
              {/* Couple name links to contacts detail */}
              <Link
                href={`/preview/contacts/${item.id}`}
                className="text-base font-semibold tracking-tight text-foreground underline-offset-2 hover:underline"
              >
                {item.coupleName}
              </Link>
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
              {item.budget && (
                <span className="tabular-nums font-medium text-foreground">
                  {gbp(item.budget)} budget
                </span>
              )}
            </div>
          </div>

          {/* Right rail: stage + score + assignee */}
          <div className="flex flex-wrap items-center gap-2">
            <StageBadge stage={item.stage} />
            <ScoreChip score={item.score} />

            {/* Assignee popover */}
            <div className="flex items-center gap-1.5">
              {assignee && (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {assignee.name}
                </span>
              )}
              <AssigneePopover
                team={TEAM}
                currentOwnerId={ownerId}
                onAssign={onAssign}
              />
            </div>
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
      <ThreadComposer key={item.id} item={item} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty states
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

function EmptyList({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Mail className="size-6" />
      </div>
      {query ? (
        <>
          <p className="text-sm font-medium text-foreground">
            No conversations match &ldquo;{query}&rdquo;
          </p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Try searching by couple name, message preview, or email address.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-foreground">
            No conversations here
          </p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Conversations appear here as soon as a couple gets in touch via
            Email, SMS or WhatsApp.
          </p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter chip — reusable inside DataToolbar children
// ---------------------------------------------------------------------------

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        "min-h-[28px] border",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:border-primary/20 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Root client component
// ---------------------------------------------------------------------------

export function InboxClient({ conversations }: InboxClientProps) {
  // ── Smart list / view state ──────────────────────────────────────────────
  const [activeView, setActiveView] = React.useState<"mine" | "all" | "unread">(
    "all",
  );

  // ── Triage state — per-item overrides (optimistic) ────────────────────────
  const [readOverrides, setReadOverrides] = React.useState<
    Record<string, boolean>
  >({});
  const [ownerOverrides, setOwnerOverrides] = React.useState<
    Record<string, string>
  >({});

  // ── Search + filter state ────────────────────────────────────────────────
  const [query, setQuery] = React.useState("");
  const [channelFilter, setChannelFilter] = React.useState<Channel | null>(
    null,
  );
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [sortBy, setSortBy] = React.useState("recent");

  // ── Selection (bulk) ─────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // ── Thread selection ──────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = React.useState<string>(
    conversations[0]?.id ?? "",
  );
  const [mobileShowThread, setMobileShowThread] = React.useState(false);

  // ── Derived helpers ───────────────────────────────────────────────────────

  function isRead(item: ConversationItem): boolean {
    // If there's an optimistic override, use it; else unread > 0 = unread
    if (item.id in readOverrides) return readOverrides[item.id];
    return item.unread === 0;
  }

  function getOwner(item: ConversationItem): string {
    return ownerOverrides[item.id] ?? item.ownerId;
  }

  // ── Smart list counts ─────────────────────────────────────────────────────
  const mineCount = conversations.filter((c) => getOwner(c) === "u1").length;
  const allCount = conversations.length;
  const unreadCount = conversations.filter((c) => !isRead(c)).length;

  const smartLists = [
    { id: "mine", name: "Mine", count: mineCount },
    { id: "all", name: "All", count: allCount },
    { id: "unread", name: "Unread", count: unreadCount },
  ];

  // ── Filtered + sorted list ────────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    let list = [...conversations];

    // Smart list
    if (activeView === "mine") {
      list = list.filter((c) => getOwner(c) === "u1");
    } else if (activeView === "unread") {
      list = list.filter((c) => !isRead(c));
    }

    // Search: coupleName, email, lastMessagePreview
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (c) =>
          c.coupleName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.lastMessagePreview.toLowerCase().includes(q),
      );
    }

    // Channel filter
    if (channelFilter) {
      list = list.filter((c) => c.lastChannel === channelFilter);
    }

    // Unread filter chip
    if (unreadOnly) {
      list = list.filter((c) => !isRead(c));
    }

    // Sort
    if (sortBy === "recent") {
      list.sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime(),
      );
    } else if (sortBy === "unread") {
      list.sort((a, b) => {
        const aUnread = isRead(a) ? 0 : a.unread;
        const bUnread = isRead(b) ? 0 : b.unread;
        return bUnread - aUnread || new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });
    } else if (sortBy === "name") {
      list.sort((a, b) => a.coupleName.localeCompare(b.coupleName));
    }

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, activeView, query, channelFilter, unreadOnly, sortBy, readOverrides, ownerOverrides]);

  // ── Selected item ──────────────────────────────────────────────────────────
  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function selectConversation(id: string) {
    setSelectedId(id);
    setMobileShowThread(true);
    // Optimistically mark as read when opening
    setReadOverrides((prev) => ({ ...prev, [id]: true }));
  }

  function handleMarkRead(id: string) {
    const item = conversations.find((c) => c.id === id);
    if (!item) return;
    const wasRead = isRead(item);
    setReadOverrides((prev) => ({ ...prev, [id]: !wasRead }));
    toast(wasRead ? "Marked as unread." : "Marked as read.");
  }

  function handleSnooze(id: string) {
    const item = conversations.find((c) => c.id === id);
    toast(`Snoozed ${item?.coupleName ?? "conversation"} for 1 day.`);
  }

  function handleAssign(contactId: string, memberId: string) {
    const member = TEAM.find((m) => m.id === memberId);
    setOwnerOverrides((prev) => ({ ...prev, [contactId]: memberId }));
    toast.success(`Assigned to ${member?.name ?? "team member"}.`);
  }

  function handleBack() {
    setMobileShowThread(false);
  }

  // Bulk actions
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function bulkMarkRead() {
    const updates: Record<string, boolean> = {};
    for (const id of selectedIds) updates[id] = true;
    setReadOverrides((prev) => ({ ...prev, ...updates }));
    toast.success(`Marked ${selectedIds.size} conversations as read.`);
    clearSelection();
  }

  function bulkSnooze() {
    toast(`Snoozed ${selectedIds.size} conversations for 1 day.`);
    clearSelection();
  }

  // ── Channel filter toggle ─────────────────────────────────────────────────
  function toggleChannel(ch: Channel) {
    setChannelFilter((prev) => (prev === ch ? null : ch));
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100dvh-140px)] min-h-[500px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Two-pane layout inside */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT — conversation list */}
        <div
          className={cn(
            "flex w-full flex-col border-r border-border md:w-[340px] md:flex-shrink-0 lg:w-[380px]",
            mobileShowThread ? "hidden md:flex" : "flex",
          )}
        >
          {/* List header */}
          <div className="border-b border-border px-4 pb-0 pt-3">
            {/* Smart list tabs */}
            <SmartListBar
              lists={smartLists}
              activeId={activeView}
              onChange={(id) =>
                setActiveView(id as "mine" | "all" | "unread")
              }
            />
          </div>

          {/* DataToolbar */}
          <div className="border-b border-border px-3 py-2">
            <DataToolbar
              search={{
                value: query,
                onChange: setQuery,
                placeholder: "Search conversations…",
              }}
              sort={{
                value: sortBy,
                onChange: setSortBy,
                options: [
                  { value: "recent", label: "Most recent" },
                  { value: "unread", label: "Unread first" },
                  { value: "name", label: "Name A–Z" },
                ],
              }}
              resultCount={filtered.length}
              totalCount={conversations.length}
            >
              {/* Channel filter chips */}
              <FilterChip
                label="Email"
                active={channelFilter === "email"}
                onClick={() => toggleChannel("email")}
              />
              <FilterChip
                label="SMS"
                active={channelFilter === "sms"}
                onClick={() => toggleChannel("sms")}
              />
              <FilterChip
                label="WhatsApp"
                active={channelFilter === "whatsapp"}
                onClick={() => toggleChannel("whatsapp")}
              />
              <FilterChip
                label="Unread"
                active={unreadOnly}
                onClick={() => setUnreadOnly((v) => !v)}
              />
            </DataToolbar>
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="border-b border-border px-3 py-2">
              <BulkActionBar count={selectedIds.size} onClear={clearSelection}>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={bulkMarkRead}
                >
                  <CheckCheck className="mr-1 size-3.5" />
                  Mark read
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={bulkSnooze}
                >
                  <Clock className="mr-1 size-3.5" />
                  Snooze
                </Button>
              </BulkActionBar>
            </div>
          )}

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {filtered.length === 0 ? (
              <EmptyList query={query} />
            ) : (
              filtered.map((item) => (
                <ConversationRow
                  key={item.id}
                  item={item}
                  isSelected={item.id === selectedId}
                  isRead={isRead(item)}
                  ownerId={getOwner(item)}
                  onClick={() => selectConversation(item.id)}
                  onMarkRead={() => handleMarkRead(item.id)}
                  onSnooze={() => handleSnooze(item.id)}
                  onAssign={(memberId) => handleAssign(item.id, memberId)}
                />
              ))
            )}
          </div>

          {/* Selection hint footer */}
          {filtered.length > 0 && selectedIds.size === 0 && (
            <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
              Click a row to open · hover for quick actions
            </div>
          )}
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
          {selected ? (
            <ThreadDetail
              item={selected}
              ownerId={getOwner(selected)}
              onBack={handleBack}
              onAssign={(memberId) => handleAssign(selected.id, memberId)}
            />
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
    </div>
  );
}
