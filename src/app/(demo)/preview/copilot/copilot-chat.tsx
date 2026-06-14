"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Send,
  Sparkles,
  User,
  CheckCircle2,
  Clock,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  primaryWedding,
  formatLongDate,
} from "@/lib/mock";

// ---------------------------------------------------------------------------
// Derive the Henderson & Carter assistant answer from live mock data
// ---------------------------------------------------------------------------

function buildHendersonAnswer(): { intro: string; items: string[] } {
  const w = primaryWedding();

  const incompleteTasks = w.tasks
    .filter((t) => !t.done)
    .map((t) => ({
      label: t.label,
      due: t.dueDate ? formatLongDate(t.dueDate) : null,
    }));

  const unconfirmedSuppliers = w.suppliers
    .filter((s) => s.status !== "confirmed")
    .map((s) => `${s.name} (${s.category}) — ${s.status}`);

  const items: string[] = [
    ...incompleteTasks.map((t) =>
      t.due ? `${t.label} — due ${t.due}` : t.label,
    ),
    ...unconfirmedSuppliers.map((s) => `Supplier: ${s}`),
  ];

  return {
    intro: `Here's what's still outstanding for ${w.coupleName} ahead of ${formatLongDate(w.date)}:`,
    items,
  };
}

// ---------------------------------------------------------------------------
// Static chat history
// ---------------------------------------------------------------------------

type Role = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: Role;
  text?: string;
  listAnswer?: ReturnType<typeof buildHendersonAnswer>;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "cm1",
    role: "user",
    text: "What's left to confirm for the Hendersons?",
  },
  {
    id: "cm2",
    role: "assistant",
    listAnswer: buildHendersonAnswer(),
  },
  {
    id: "cm3",
    role: "user",
    text: "Thanks. Is our conversion rate on track vs last quarter?",
  },
  {
    id: "cm4",
    role: "assistant",
    text: "Your current conversion rate is 16.9%, up from ~14.2% in Q1. The biggest mover is Instagram — 9 bookings from 44 enquiries (20.5%). Referrals are close behind at 27.8%. Google has dropped to 11.1% this quarter, worth a review of the ad creative.",
  },
];

const SUGGESTED_PROMPTS = [
  "Draft a follow-up for Khan & Reid",
  "Which bookings are at risk?",
  "Revenue this month",
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AssistantBubble({ msg }: { msg: ChatMessage }) {
  if (msg.listAnswer) {
    const { intro, items } = msg.listAnswer;
    return (
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-fun-pink text-fun-pink-foreground">
          <Sparkles className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-muted px-4 py-3 text-sm text-foreground">
          <p className="mb-2 font-medium">{intro}</p>
          <ul className="space-y-1.5">
            {items.map((item, i) => {
              const isSupplier = item.startsWith("Supplier:");
              return (
                <li key={i} className="flex items-start gap-2">
                  {isSupplier ? (
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning-foreground" />
                  ) : (
                    <Clock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className={cn("text-sm", isSupplier && "text-warning-foreground font-medium")}>
                    {item}
                  </span>
                </li>
              );
            })}
          </ul>
          {items.length === 0 && (
            <p className="flex items-center gap-1.5 text-sm text-success-foreground">
              <CheckCircle2 className="size-4" />
              Everything is confirmed — this wedding is ready.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-fun-pink text-fun-pink-foreground">
        <Sparkles className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-muted px-4 py-3 text-sm text-foreground">
        {msg.text}
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex items-start justify-end gap-3">
      <div className="max-w-[80%] rounded-xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground">
        {text}
      </div>
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <User className="size-3.5" />
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function CopilotChat() {
  const [messages] = useState<ChatMessage[]>(INITIAL_MESSAGES);

  function handleSend() {
    toast("This is a prototype — the AI Copilot is coming soon.", {
      description: "In production, this sends your message to the VenueFlow AI.",
    });
  }

  function handleSuggest(prompt: string) {
    toast(`Sending: "${prompt}"`, {
      description: "In production, this triggers a real AI response.",
    });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Message thread */}
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.map((msg) =>
          msg.role === "assistant" ? (
            <AssistantBubble key={msg.id} msg={msg} />
          ) : (
            <UserBubble key={msg.id} text={msg.text ?? ""} />
          ),
        )}
      </div>

      {/* Suggested prompts */}
      <div className="border-t border-border px-5 pt-4 pb-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Try asking
        </p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => handleSuggest(p)}
              className="min-h-[36px] rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm active:translate-y-0"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border px-5 py-4">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
          <input
            type="text"
            placeholder="Ask about any booking, lead, or wedding..."
            className="min-h-[28px] flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
          />
          <Button
            size="icon-sm"
            onClick={handleSend}
            aria-label="Send message"
          >
            <Send className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
