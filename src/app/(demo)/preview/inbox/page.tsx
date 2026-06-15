import { PageHeader } from "@/components/layout/page-header";
import { CONTACTS, CONVERSATIONS, getConversation } from "@/lib/mock";
import { InboxClient, type ConversationItem } from "./inbox-client";

export const metadata = { title: "Unified Inbox" };

export default function InboxPage() {
  // Build the conversation list: contacts who have at least one message,
  // sorted by lastMessageAt descending (most recent first).
  const conversations: ConversationItem[] = CONTACTS.filter((contact) =>
    CONVERSATIONS.some((c) => c.contactId === contact.id),
  )
    .sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime(),
    )
    .map((contact) => ({
      ...contact,
      thread: getConversation(contact.id),
    }));

  return (
    <div className="mx-auto flex h-full flex-col max-w-[1400px]">
      <PageHeader
        title="Unified Inbox"
        subtitle="Email, SMS and WhatsApp in one threaded view — every couple, every channel, no tab-switching."
      />
      <InboxClient conversations={conversations} />
    </div>
  );
}
