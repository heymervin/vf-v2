"use client";

/**
 * PortalClient — the couple-facing planning portal shell.
 *
 * Tabs:
 *   home      — countdown hero, planning progress, what's-next, quick links
 *   menu      — per-course pick (starter / main / dessert) with optimistic state
 *   guests    — add / edit / RSVP / dietary / +1 name, optimistic
 *   seating   — read-only ShapedTable canvas of their assigned tables
 *   messages  — real thread via getConversation + composer (toast)
 *   payments  — per-milestone pay + receipts (P1)
 *   contract  — e-sign with contractTerms (P1)
 */

import * as React from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { EntitySheet } from "@/components/entity-sheet";
import { ShapedTable } from "@/components/floorplan/shaped-table";
import { FloorCanvas } from "@/components/floorplan/floor-canvas";
import { cn } from "@/lib/utils";
import type { FloorplanTable, RoomElement } from "@/lib/mock/planning";
import {
  CheckCircle2,
  Circle,
  Clock,
  CreditCard,
  FileText,
  Users,
  UtensilsCrossed,
  Calendar,
  MessageCircle,
  ArrowRight,
  AlertCircle,
  ChevronRight,
  Home,
  Send,
  Plus,
  Download,
  ExternalLink,
  CheckSquare,
  LayoutGrid,
  Pencil,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Mirrored types (no re-export from mock to avoid server-only constraint)
// ---------------------------------------------------------------------------

interface PaymentMilestone {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
  status: "paid" | "due" | "upcoming" | "overdue";
  paidOn?: string | null;
  receiptUrl?: string | null;
}

interface WeddingTask {
  id: string;
  label: string;
  done: boolean;
  dueDate: string | null;
  category: "money" | "planning" | "suppliers" | "admin";
}

interface MenuOption {
  id: string;
  name: string;
  allergens: string[];
  chosenBy: number;
  description?: string | null;
  dietaryTags?: string[];
}

interface MenuCourse {
  id: string;
  course: string;
  options: MenuOption[];
  sortOrder?: number;
  isActive?: boolean;
}

interface Guest {
  id: string;
  name: string;
  side: "partner1" | "partner2" | "both";
  table: number | null;
  rsvp: "yes" | "no" | "pending";
  dietary: string[];
  plusOne: boolean;
  tags?: string[];
  householdId?: string | null;
  householdName?: string | null;
  plusOneName?: string | null;
  sessionType?: "day" | "evening" | "ceremony_only";
  mealChoice?: { starter?: string; main?: string; dessert?: string };
}

interface RunsheetItem {
  id: string;
  time: string;
  title: string;
  category: "ceremony" | "reception" | "catering" | "supplier" | "logistics";
}

interface Message {
  id: string;
  contactId: string;
  channel: "email" | "sms" | "whatsapp";
  direction: "in" | "out";
  body: string;
  at: string;
  author: string;
}

interface WeddingDoc {
  id: string;
  name: string;
  kind: "contract" | "insurance" | "invoice" | "supplier" | "other";
  status: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Prop shape — matches what page.tsx currently passes + new fields optional
// ---------------------------------------------------------------------------

export interface PortalClientProps {
  partner1First: string;
  partner2First: string;
  venueName: string;
  daysUntil: number;
  weddingDate: string;
  guestCount: number;
  coupleTasks: WeddingTask[];
  payments: PaymentMilestone[];
  contractStatus: string;
  menu: MenuCourse[];
  guests: Guest[];
  runsheet: RunsheetItem[];
  totalValue: number;
  paid: number;
  space: string;
  // New optional fields (set by the new page.tsx; gracefully absent from old)
  venueEmail?: string;
  packageName?: string;
  progressPct?: number;
  nextTask?: WeddingTask | null;
  contractTerms?: string[];
  docs?: WeddingDoc[];
  messages?: Message[];
  coordinatorName?: string;
  floorplanTables?: FloorplanTable[];
  roomElements?: RoomElement[];
  portalTheme?: { accent: string; logoText: string; welcomeNote?: string } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gbpFmt(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMessageDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return formatTime(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const CHANNEL_ICON: Record<string, string> = {
  email: "✉",
  sms: "💬",
  whatsapp: "📱",
};

const DIETARY_OPTIONS = [
  "None",
  "Vegetarian",
  "Vegan",
  "Gluten-free",
  "Dairy-free",
  "Nut allergy",
  "Pescatarian",
  "Halal",
  "Kosher",
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PortalClient({
  partner1First,
  partner2First,
  venueName,
  daysUntil,
  weddingDate,
  guestCount,
  coupleTasks,
  payments,
  contractStatus,
  menu,
  guests: initialGuests,
  runsheet,
  totalValue,
  paid,
  space,
  venueEmail,
  packageName,
  progressPct: serverProgressPct,
  nextTask: serverNextTask,
  contractTerms = [],
  docs = [],
  messages: initialMessages = [],
  coordinatorName = "Your coordinator",
  floorplanTables = [],
  roomElements = [],
  portalTheme,
}: PortalClientProps) {
  // ── Derived base values ─────────────────────────────────────────────────
  const allTasks = coupleTasks;
  const doneTasks = allTasks.filter((t) => t.done).length;
  const progressPct =
    serverProgressPct ??
    (allTasks.length > 0
      ? Math.round((doneTasks / allTasks.length) * 100)
      : 0);
  const nextTask =
    serverNextTask !== undefined
      ? serverNextTask
      : allTasks.find((t) => !t.done) ?? null;

  const paidPct =
    totalValue > 0 ? Math.round((paid / totalValue) * 100) : 0;
  const balance = totalValue - paid;

  // ── Optimistic: menu selections ─────────────────────────────────────────
  // coupleMenuChoice maps courseId → optionId (starter/main/dessert pick)
  const [menuChoices, setMenuChoices] = React.useState<
    Record<string, string>
  >(() => {
    // Pre-seed from the first guest's mealChoice if available
    const first = initialGuests.find(
      (g) => g.mealChoice && g.sessionType === "day",
    );
    if (!first?.mealChoice) return {};
    const mc = first.mealChoice;
    // Map option ids back to course ids
    const result: Record<string, string> = {};
    menu.forEach((course) => {
      const matchKey =
        course.course.toLowerCase() as keyof typeof mc;
      const optId = mc[matchKey];
      if (optId) result[course.id] = optId;
    });
    return result;
  });

  function pickMenuOption(courseId: string, optionId: string) {
    setMenuChoices((prev) => ({ ...prev, [courseId]: optionId }));
    const course = menu.find((c) => c.id === courseId);
    const option = course?.options.find((o) => o.id === optionId);
    toast.success(`${course?.course ?? "Course"} updated`, {
      description: option?.name ?? "Choice saved",
    });
  }

  // ── Optimistic: guests ──────────────────────────────────────────────────
  const [guests, setGuests] = React.useState<Guest[]>(initialGuests);

  function addGuest(g: Omit<Guest, "id" | "side" | "table" | "plusOne">) {
    const newGuest: Guest = {
      id: `g-new-${Date.now()}`,
      side: "partner1",
      table: null,
      plusOne: false,
      ...g,
    };
    setGuests((prev) => [...prev, newGuest]);
    toast.success("Guest added", { description: newGuest.name });
  }

  function updateGuest(id: string, patch: Partial<Guest>) {
    setGuests((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    );
    toast.success("Guest updated");
  }

  // ── Optimistic: messages ────────────────────────────────────────────────
  const [messages, setMessages] = React.useState<Message[]>(initialMessages);
  const [composerText, setComposerText] = React.useState("");
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  function sendMessage() {
    const body = composerText.trim();
    if (!body) return;
    const msg: Message = {
      id: `msg-new-${Date.now()}`,
      contactId: "c1",
      channel: "whatsapp",
      direction: "in",
      body,
      at: new Date().toISOString(),
      author: `${partner1First} & ${partner2First}`,
    };
    setMessages((prev) => [...prev, msg]);
    setComposerText("");
    toast.success("Message sent", {
      description: `${coordinatorName} will reply within a few hours.`,
    });
    // Scroll to bottom after render
    setTimeout(
      () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );
  }

  // ── Tab counts ───────────────────────────────────────────────────────────
  const rsvpYes = guests.filter((g) => g.rsvp === "yes").length;
  const rsvpPending = guests.filter((g) => g.rsvp === "pending").length;
  const rsvpPct =
    guests.length > 0 ? Math.round((rsvpYes / guests.length) * 100) : 0;
  const unreadMessages = messages.filter((m) => m.direction === "out" && false)
    .length; // placeholder; in real app would track read state

  // Next undone payment
  const nextPayment = payments.find(
    (p) => p.status === "due" || p.status === "overdue" || p.status === "upcoming",
  );

  // ── What's next callout ──────────────────────────────────────────────────
  const overduePayment = payments.find((p) => p.status === "overdue");
  const duePayment = payments.find((p) => p.status === "due");
  const whatNextSeverity: "destructive" | "warning" | "info" = overduePayment
    ? "destructive"
    : duePayment
      ? "warning"
      : "info";
  const whatNextTitle = overduePayment
    ? `${overduePayment.label} is overdue (${gbpFmt(overduePayment.amount)})`
    : duePayment
      ? `${duePayment.label} is due now (${gbpFmt(duePayment.amount)})`
      : nextTask
        ? nextTask.label
        : "You're all up to date — great work!";

  // ── Tables that seat this couple's guests ───────────────────────────────
  const guestTableNums = new Set(
    guests
      .filter((g) => g.table !== null && g.rsvp !== "no")
      .map((g) => g.table as number),
  );

  return (
    <>
      <Toaster position="bottom-center" />

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <div className="mb-8 rounded-2xl bg-fun-pink/30 px-7 py-9 ring-1 ring-fun-pink-strong/20">
        {portalTheme?.welcomeNote && (
          <p className="mb-3 text-sm italic text-muted-foreground">
            &ldquo;{portalTheme.welcomeNote}&rdquo;
          </p>
        )}
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Welcome back
        </p>
        <h1 className="mb-1 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Hi {partner1First} &amp; {partner2First}
        </h1>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Your big day
            </p>
            <p className="mt-0.5 text-lg font-medium tabular-nums text-foreground">
              {weddingDate}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {space}
              {packageName ? ` · ${packageName}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-4xl font-bold tabular-nums leading-none text-foreground">
                {daysUntil}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">days to go</p>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="text-center">
              <p className="text-4xl font-bold tabular-nums leading-none text-foreground">
                {guestCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">guests</p>
            </div>
          </div>
        </div>

        {/* Planning progress bar */}
        <div className="mt-6">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">Planning progress</span>
            <span className="tabular-nums">{progressPct}% complete</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>
      </div>

      {/* ── TABS ──────────────────────────────────────────────────────── */}
      <Tabs defaultValue="home" className="gap-6">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto w-max min-w-full justify-start gap-1 bg-muted/60 p-1.5 sm:w-full">
            <TabsTrigger value="home" className="min-h-[36px] gap-1.5 whitespace-nowrap">
              <Home className="size-3.5" />
              Home
            </TabsTrigger>
            <TabsTrigger value="menu" className="min-h-[36px] gap-1.5 whitespace-nowrap">
              <UtensilsCrossed className="size-3.5" />
              Menu
            </TabsTrigger>
            <TabsTrigger value="guests" className="min-h-[36px] gap-1.5 whitespace-nowrap">
              <Users className="size-3.5" />
              Guests
              {rsvpPending > 0 && (
                <span className="ml-0.5 rounded-full bg-warning/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-warning-foreground">
                  {rsvpPending}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="seating" className="min-h-[36px] gap-1.5 whitespace-nowrap">
              <LayoutGrid className="size-3.5" />
              Seating
            </TabsTrigger>
            <TabsTrigger value="messages" className="min-h-[36px] gap-1.5 whitespace-nowrap">
              <MessageCircle className="size-3.5" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="payments" className="min-h-[36px] gap-1.5 whitespace-nowrap">
              <CreditCard className="size-3.5" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="contract" className="min-h-[36px] gap-1.5 whitespace-nowrap">
              <FileText className="size-3.5" />
              Contract
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── HOME ──────────────────────────────────────────────────── */}
        <TabsContent value="home" className="flex flex-col gap-4">
          {/* What's next callout */}
          <WhatNextCallout
            severity={whatNextSeverity}
            title={whatNextTitle}
          />

          {/* Quick stats grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <QuickStat
              label="Confirmed guests"
              value={rsvpYes}
              sub={`of ${guests.length} invited`}
              colour="fun-green"
            />
            <QuickStat
              label="Pending RSVPs"
              value={rsvpPending}
              sub="still to respond"
              colour={rsvpPending > 10 ? "warning" : "muted"}
            />
            <QuickStat
              label="Amount paid"
              value={gbpFmt(paid)}
              sub={`of ${gbpFmt(totalValue)}`}
              colour="fun-blue"
              mono
            />
            <QuickStat
              label="Balance remaining"
              value={gbpFmt(balance)}
              sub={nextPayment ? `due ${formatDate(nextPayment.dueDate)}` : "no due date"}
              colour={balance > 0 ? "muted" : "fun-green"}
              mono
            />
          </div>

          {/* To-do list */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Things to take care of</CardTitle>
              <CardDescription>
                We&apos;ll keep this list updated as your wedding gets closer.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pb-5">
              {allTasks.length === 0 ? (
                <EmptyTodo />
              ) : (
                <>
                  {allTasks.slice(0, 5).map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                  {allTasks.length > 5 && (
                    <p className="pt-1 text-xs text-muted-foreground">
                      +{allTasks.length - 5} more items across your planning checklist
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Quick links row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <QuickLink icon={<UtensilsCrossed className="size-4" />} label="Choose your menu" tab="menu" />
            <QuickLink icon={<Users className="size-4" />} label="Manage guests" tab="guests" />
            <QuickLink icon={<LayoutGrid className="size-4" />} label="View seating" tab="seating" />
            <QuickLink icon={<MessageCircle className="size-4" />} label="Message venue" tab="messages" />
          </div>
        </TabsContent>

        {/* ── MENU ──────────────────────────────────────────────────── */}
        <TabsContent value="menu">
          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Your menu choices</CardTitle>
                <CardDescription>
                  Pick one option per course. Your choices are saved automatically — let us
                  know if your requirements change and we&apos;ll update things with the kitchen.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-7 pb-6">
                {menu.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Your menu hasn&apos;t been set yet — your coordinator will be in touch soon.
                  </p>
                ) : (
                  menu
                    .slice()
                    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                    .filter((c) => c.isActive !== false)
                    .map((course) => (
                      <MenuCourseBlock
                        key={course.id}
                        course={course}
                        selectedId={menuChoices[course.id] ?? null}
                        onPick={(optId) => pickMenuOption(course.id, optId)}
                      />
                    ))
                )}
              </CardContent>
            </Card>

            {/* Allergen note */}
            <div className="rounded-xl bg-warning/15 px-4 py-3 text-sm text-warning-foreground">
              <strong>Allergen information:</strong> All dishes are prepared in a kitchen
              that handles gluten, dairy, nuts, and eggs. Please contact your coordinator
              to discuss any serious allergies — we&apos;ll work with the kitchen to accommodate
              your guests safely.
            </div>

            <Button
              variant="outline"
              onClick={() =>
                toast.info("Message sent to your coordinator", {
                  description:
                    "They&apos;ll contact the catering team and confirm any changes.",
                })
              }
            >
              Request a menu change
            </Button>
          </div>
        </TabsContent>

        {/* ── GUESTS ────────────────────────────────────────────────── */}
        <TabsContent value="guests">
          <div className="flex flex-col gap-4">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <QuickStat label="Confirmed" value={rsvpYes} colour="fun-green" />
              <QuickStat label="Pending" value={rsvpPending} colour="warning" />
              <QuickStat label="Invited" value={guests.length} colour="fun-blue" />
            </div>

            {/* RSVP progress */}
            {guests.length > 0 && (
              <div>
                <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                  <span>RSVP progress</span>
                  <span className="tabular-nums">{rsvpPct}% responded</span>
                </div>
                <Progress
                  value={rsvpPct}
                  className="h-2"
                />
              </div>
            )}

            {/* Add guest CTA */}
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Guest list
              </p>
              <AddGuestSheet onAdd={addGuest} />
            </div>

            {/* Guest rows */}
            <div className="flex flex-col gap-2">
              {guests.length === 0 ? (
                <div className="rounded-xl bg-muted/60 px-5 py-8 text-center">
                  <Users className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                  <p className="font-medium text-foreground">No guests yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add your first guest to get started.
                  </p>
                </div>
              ) : (
                guests.map((guest) => (
                  <GuestRow key={guest.id} guest={guest} onUpdate={updateGuest} />
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── SEATING ───────────────────────────────────────────────── */}
        <TabsContent value="seating">
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Your seating plan</CardTitle>
                <CardDescription>
                  A read-only view of the current seating arrangements in {space}. Your
                  coordinator manages the full plan — message them if you&apos;d like any changes.
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-5">
                {floorplanTables.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Seating hasn&apos;t been arranged yet — check back closer to the day.
                  </p>
                ) : (
                  <FloorCanvas roomElements={roomElements}>
                    {floorplanTables.map((table) => {
                      const tableGuests = guests.filter(
                        (g) => g.table === table.tableNumber && g.rsvp !== "no",
                      );
                      return (
                        <div
                          key={table.id}
                          className="absolute -translate-x-1/2 -translate-y-1/2"
                          style={{
                            left: `${table.x}%`,
                            top: `${table.y}%`,
                          }}
                        >
                          <ShapedTable
                            table={table}
                            seatedGuests={tableGuests}
                            sizePx={84}
                          />
                        </div>
                      );
                    })}
                  </FloorCanvas>
                )}
              </CardContent>
            </Card>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 px-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-3 rounded-full bg-fun-blue/80" />
                Seated
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-3 rounded-full bg-muted" />
                Empty seat
              </span>
            </div>

            {/* Table summary */}
            {guestTableNums.size > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-[0.08em]">
                    Your tables
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="flex flex-col gap-1.5">
                    {floorplanTables
                      .filter((t) => guestTableNums.has(t.tableNumber))
                      .map((t) => {
                        const seated = guests.filter(
                          (g) => g.table === t.tableNumber && g.rsvp !== "no",
                        ).length;
                        return (
                          <div
                            key={t.id}
                            className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"
                          >
                            <span className="font-medium text-foreground">
                              Table {t.tableNumber}
                              {t.label ? ` — ${t.label}` : ""}
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              {seated}/{t.capacity} seats
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}

            <Button
              variant="outline"
              onClick={() =>
                toast.info("Message sent to your coordinator", {
                  description: "They&apos;ll be in touch about any seating changes.",
                })
              }
            >
              Request a seating change
            </Button>
          </div>
        </TabsContent>

        {/* ── MESSAGES ──────────────────────────────────────────────── */}
        <TabsContent value="messages">
          <div className="flex flex-col gap-4">
            <Card className="overflow-hidden">
              <CardHeader className="border-b border-border pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fun-teal/50">
                    <MessageCircle className="size-4 text-fun-teal-strong" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">{venueName}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {coordinatorName} · usually replies within a few hours
                    </p>
                  </div>
                </div>
              </CardHeader>
              {/* Thread */}
              <CardContent className="flex flex-col gap-2 px-4 pb-0 pt-4 max-h-[400px] overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No messages yet. Send your first message below.
                  </div>
                ) : (
                  messages.map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} />
                  ))
                )}
                <div ref={messagesEndRef} />
              </CardContent>

              {/* Composer */}
              <div className="border-t border-border px-4 py-3">
                <div className="flex gap-2">
                  <Textarea
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    placeholder="Type a message to your venue…"
                    className="min-h-[60px] resize-none text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    className="h-auto self-end px-3 py-2 min-h-[44px]"
                    onClick={sendMessage}
                    disabled={!composerText.trim()}
                    aria-label="Send message"
                  >
                    <Send className="size-4" />
                  </Button>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  ⌘↵ to send
                </p>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ── PAYMENTS ──────────────────────────────────────────────── */}
        <TabsContent value="payments">
          <div className="flex flex-col gap-4">
            {/* Summary */}
            <Card>
              <CardContent className="py-5">
                <div className="mb-3 flex items-baseline justify-between">
                  <p className="text-sm font-medium text-muted-foreground">
                    Total paid
                  </p>
                  <p className="text-sm tabular-nums text-muted-foreground">
                    <span className="text-lg font-semibold text-foreground tabular-nums">
                      {gbpFmt(paid)}
                    </span>{" "}
                    of {gbpFmt(totalValue)}
                  </p>
                </div>
                <Progress value={paidPct} className="h-2.5" />
                <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                  {paidPct}% paid &middot; {gbpFmt(balance)} remaining
                </p>
              </CardContent>
            </Card>

            {/* Milestones */}
            {payments.map((pm) => (
              <PaymentRow key={pm.id} milestone={pm} />
            ))}

            {/* Pay CTA */}
            {balance > 0 && (
              <Button
                size="lg"
                className="w-full sm:w-auto"
                onClick={() =>
                  toast.success("Redirecting to payment…", {
                    description:
                      "In the live product, this opens your secure payment page.",
                  })
                }
              >
                Pay balance — {gbpFmt(balance)}
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </TabsContent>

        {/* ── CONTRACT ──────────────────────────────────────────────── */}
        <TabsContent value="contract">
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Booking contract</CardTitle>
                <CardDescription>
                  Your agreement with {venueName}.
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-6">
                {contractStatus === "signed" ? (
                  <div className="flex items-start gap-4 rounded-xl bg-fun-green/40 p-5">
                    <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-fun-green-strong" />
                    <div>
                      <p className="font-semibold text-foreground">Contract signed</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Your booking is confirmed. A copy has been sent to your email.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-4 rounded-xl bg-warning/40 p-5">
                      <AlertCircle className="mt-0.5 size-6 shrink-0 text-warning-foreground" />
                      <div>
                        <p className="font-semibold text-foreground">
                          Awaiting your signature
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Please review and sign your booking contract to confirm your date.
                        </p>
                      </div>
                    </div>

                    {/* Contract terms */}
                    {contractTerms.length > 0 && (
                      <div className="rounded-xl border border-border bg-muted/30 px-5 py-4">
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Key terms
                        </p>
                        <ol className="flex flex-col gap-2">
                          {contractTerms.map((term, i) => (
                            <li key={i} className="flex gap-2.5 text-sm text-foreground">
                              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground">
                                {i + 1}
                              </span>
                              {term}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    <Button
                      onClick={() =>
                        toast.info("Opening contract…", {
                          description:
                            "In the live product, this opens your e-signature document.",
                        })
                      }
                    >
                      Review &amp; sign contract
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Docs */}
            {docs.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Documents
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="flex flex-col gap-2">
                    {docs.map((doc) => (
                      <DocRow key={doc.id} doc={doc} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── FOOTER MESSAGE STRIP (always visible) ─────────────────────── */}
      <div className="mt-8">
        <Card className="ring-1 ring-fun-teal-strong/20">
          <CardContent className="flex flex-col items-start gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-fun-teal/50">
                <MessageCircle className="size-5 text-fun-teal-strong" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Got a question?</p>
                <p className="text-sm text-muted-foreground">
                  {coordinatorName} replies within a few hours.
                  {venueEmail && (
                    <> Or email{" "}
                      <a
                        href={`mailto:${venueEmail}`}
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        {venueEmail}
                      </a>
                    </>
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full min-h-[44px] sm:w-auto"
              onClick={() => {
                setComposerText("");
                toast.info("Head to the Messages tab to chat with your venue.");
              }}
            >
              Send a message
              <ArrowRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// ── What's next callout ─────────────────────────────────────────────────────

function WhatNextCallout({
  severity,
  title,
}: {
  severity: "destructive" | "warning" | "info";
  title: string;
}) {
  const map = {
    destructive: {
      bg: "bg-destructive/10",
      icon: <AlertCircle className="size-4 text-destructive" />,
    },
    warning: {
      bg: "bg-warning/15",
      icon: <AlertCircle className="size-4 text-warning-foreground" />,
    },
    info: {
      bg: "bg-accent",
      icon: <CheckCircle2 className="size-4 text-accent-foreground" />,
    },
  } as const;
  const { bg, icon } = map[severity];

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl px-4 py-3.5 min-h-[44px]",
        bg,
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          What&apos;s next
        </p>
        <p className="mt-0.5 text-sm font-medium text-foreground">{title}</p>
      </div>
    </div>
  );
}

// ── Quick stat tile ─────────────────────────────────────────────────────────

function QuickStat({
  label,
  value,
  sub,
  colour,
  mono,
}: {
  label: string;
  value: string | number;
  sub?: string;
  colour: "fun-green" | "warning" | "fun-blue" | "muted";
  mono?: boolean;
}) {
  const bg: Record<typeof colour, string> = {
    "fun-green": "bg-fun-green/40",
    warning: "bg-warning/30",
    "fun-blue": "bg-fun-blue/30",
    muted: "bg-muted/60",
  };
  return (
    <div className={cn("rounded-xl px-4 py-4 text-center", bg[colour])}>
      <p
        className={cn(
          "text-2xl font-bold leading-none text-foreground",
          mono && "tabular-nums",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] font-medium text-muted-foreground">
        {label}
      </p>
      {sub && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}

// ── Quick link button ───────────────────────────────────────────────────────

function QuickLink({
  icon,
  label,
  tab,
}: {
  icon: React.ReactNode;
  label: string;
  tab: string;
}) {
  return (
    <button
      onClick={() => {
        // Find the matching tab trigger and click it
        const trigger = document.querySelector<HTMLButtonElement>(
          `[data-radix-collection-item][value="${tab}"]`,
        );
        if (trigger) trigger.click();
      }}
      className={cn(
        "flex min-h-[56px] flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-4",
        "text-center text-sm font-medium text-foreground",
        "transition-all hover:-translate-y-0.5 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-[12px] leading-tight">{label}</span>
    </button>
  );
}

// ── Task row ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  money: "Payment",
  planning: "Planning",
  suppliers: "Suppliers",
  admin: "Admin",
};

function TaskRow({ task }: { task: WeddingTask }) {
  return (
    <div
      className={cn(
        "flex min-h-[48px] items-start gap-3 rounded-lg px-3.5 py-3 ring-1 transition-all",
        task.done
          ? "bg-muted/30 ring-border/40"
          : "bg-card ring-border hover:-translate-y-0.5 hover:shadow-sm",
      )}
    >
      <span className="mt-0.5 shrink-0">
        {task.done ? (
          <CheckCircle2 className="size-4 text-fun-green-strong" />
        ) : (
          <Circle className="size-4 text-muted-foreground/50" />
        )}
      </span>
      <div className="flex flex-1 flex-col gap-0.5">
        <p
          className={cn(
            "text-sm font-medium",
            task.done
              ? "text-muted-foreground line-through"
              : "text-foreground",
          )}
        >
          {task.label}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {CATEGORY_LABELS[task.category] ?? task.category}
          </Badge>
          {task.dueDate && !task.done && (
            <span className="flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
              <Clock className="size-3" />
              Due {formatDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>
      {!task.done && (
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      )}
    </div>
  );
}

function EmptyTodo() {
  return (
    <div className="rounded-lg bg-fun-green/30 px-5 py-6 text-center">
      <CheckCircle2 className="mx-auto mb-2 size-8 text-fun-green-strong" />
      <p className="font-medium text-foreground">You&apos;re all caught up!</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Nothing outstanding right now — enjoy the calm before the big day.
      </p>
    </div>
  );
}

// ── Menu course block ────────────────────────────────────────────────────────

function MenuCourseBlock({
  course,
  selectedId,
  onPick,
}: {
  course: MenuCourse;
  selectedId: string | null;
  onPick: (optId: string) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {course.course}
      </p>
      <div className="flex flex-col gap-2.5">
        {course.options.map((opt) => {
          const isSelected = selectedId === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onPick(opt.id)}
              className={cn(
                "flex min-h-[56px] w-full items-start gap-3 rounded-xl px-4 py-3.5 ring-1 text-left transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "bg-fun-pink/30 ring-fun-pink-strong/50"
                  : "bg-card ring-border hover:-translate-y-0.5 hover:shadow-sm",
              )}
              aria-pressed={isSelected}
            >
              {/* Selection indicator */}
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ring-1.5",
                  isSelected
                    ? "bg-fun-pink-strong ring-fun-pink-strong"
                    : "bg-transparent ring-border",
                )}
              >
                {isSelected && (
                  <CheckSquare className="size-3 text-primary-foreground" />
                )}
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{opt.name}</p>
                {opt.description && (
                  <p className="mt-0.5 text-[12px] text-muted-foreground leading-snug">
                    {opt.description}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(opt.dietaryTags ?? []).map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-[10px]"
                    >
                      {tag}
                    </Badge>
                  ))}
                  {opt.allergens.map((a) => (
                    <Badge
                      key={a}
                      variant="outline"
                      className="text-[10px] border-warning/60 text-warning-foreground"
                    >
                      Contains {a}
                    </Badge>
                  ))}
                </div>
              </div>

              {isSelected && (
                <Badge variant="default" className="shrink-0 self-start mt-0.5">
                  Your choice
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Guest row ────────────────────────────────────────────────────────────────

const RSVP_BADGE: Record<string, { label: string; variant: "success" | "warning" | "secondary" | "destructive" }> = {
  yes: { label: "Coming", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
  no: { label: "Declined", variant: "destructive" },
};

function GuestRow({
  guest,
  onUpdate,
}: {
  guest: Guest;
  onUpdate: (id: string, patch: Partial<Guest>) => void;
}) {
  const rsvp = RSVP_BADGE[guest.rsvp] ?? { label: guest.rsvp, variant: "secondary" as const };

  return (
    <div className="flex min-h-[52px] items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-border transition-all hover:shadow-sm">
      {/* Avatar */}
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fun-blue/40 text-[11px] font-semibold text-fun-blue-strong">
        {guest.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
      </div>

      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {guest.name}
          {guest.plusOneName && (
            <span className="ml-2 text-[11px] font-normal text-muted-foreground">
              +{guest.plusOneName}
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {(guest.tags ?? []).slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          {guest.dietary.length > 0 && (
            <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-medium text-warning-foreground">
              {guest.dietary.join(", ")}
            </span>
          )}
          {guest.table !== null && (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              Table {guest.table}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={rsvp.variant} className="text-[10px]">
          {rsvp.label}
        </Badge>
        <EditGuestSheet guest={guest} onSave={(patch) => onUpdate(guest.id, patch)} />
      </div>
    </div>
  );
}

// ── Add guest sheet ─────────────────────────────────────────────────────────

function AddGuestSheet({
  onAdd,
}: {
  onAdd: (g: Omit<Guest, "id" | "side" | "table" | "plusOne">) => void;
}) {
  const [name, setName] = React.useState("");
  const [rsvp, setRsvp] = React.useState<"yes" | "no" | "pending">("pending");
  const [dietary, setDietary] = React.useState("None");
  const [plusOneName, setPlusOneName] = React.useState("");

  function handleSave() {
    if (!name.trim()) {
      toast.error("Please enter a guest name");
      return;
    }
    onAdd({
      name: name.trim(),
      rsvp,
      dietary: dietary !== "None" ? [dietary] : [],
      plusOneName: plusOneName.trim() || null,
      tags: [],
      sessionType: "day",
    });
    setName("");
    setRsvp("pending");
    setDietary("None");
    setPlusOneName("");
  }

  return (
    <EntitySheet
      trigger={
        <Button size="sm" className="min-h-[36px] gap-1.5">
          <Plus className="size-3.5" />
          Add guest
        </Button>
      }
      title="Add a guest"
      description="Add a guest to your list. You can edit their details any time."
      saveLabel="Add guest"
      onSave={handleSave}
    >
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="guest-name" className="mb-1.5 block text-sm">
            Full name
          </Label>
          <Input
            id="guest-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sarah Johnson"
            className="text-base"
          />
        </div>

        <div>
          <Label htmlFor="guest-rsvp" className="mb-1.5 block text-sm">
            RSVP status
          </Label>
          <Select
            value={rsvp}
            onValueChange={(v) => setRsvp(v as typeof rsvp)}
          >
            <SelectTrigger id="guest-rsvp" className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="yes">Coming</SelectItem>
              <SelectItem value="no">Declined</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="guest-dietary" className="mb-1.5 block text-sm">
            Dietary requirement
          </Label>
          <Select value={dietary} onValueChange={setDietary}>
            <SelectTrigger id="guest-dietary" className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIETARY_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="guest-plusone" className="mb-1.5 block text-sm">
            Plus-one name{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="guest-plusone"
            value={plusOneName}
            onChange={(e) => setPlusOneName(e.target.value)}
            placeholder="e.g. Tom Johnson"
            className="text-base"
          />
        </div>
      </div>
    </EntitySheet>
  );
}

// ── Edit guest sheet ─────────────────────────────────────────────────────────

function EditGuestSheet({
  guest,
  onSave,
}: {
  guest: Guest;
  onSave: (patch: Partial<Guest>) => void;
}) {
  const [rsvp, setRsvp] = React.useState<"yes" | "no" | "pending">(guest.rsvp);
  const [dietary, setDietary] = React.useState(
    guest.dietary.length > 0 ? guest.dietary[0] : "None",
  );
  const [plusOneName, setPlusOneName] = React.useState(guest.plusOneName ?? "");

  function handleSave() {
    onSave({
      rsvp,
      dietary: dietary !== "None" ? [dietary] : [],
      plusOneName: plusOneName.trim() || null,
    });
  }

  return (
    <EntitySheet
      trigger={
        <button
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Edit ${guest.name}`}
        >
          <Pencil className="size-3.5" />
        </button>
      }
      title={`Edit — ${guest.name}`}
      description="Update this guest's RSVP status and dietary requirements."
      saveLabel="Save changes"
      onSave={handleSave}
    >
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor={`rsvp-${guest.id}`} className="mb-1.5 block text-sm">
            RSVP status
          </Label>
          <Select
            value={rsvp}
            onValueChange={(v) => setRsvp(v as typeof rsvp)}
          >
            <SelectTrigger id={`rsvp-${guest.id}`} className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="yes">Coming</SelectItem>
              <SelectItem value="no">Declined</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label
            htmlFor={`dietary-${guest.id}`}
            className="mb-1.5 block text-sm"
          >
            Dietary requirement
          </Label>
          <Select value={dietary} onValueChange={setDietary}>
            <SelectTrigger id={`dietary-${guest.id}`} className="min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIETARY_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label
            htmlFor={`plusone-${guest.id}`}
            className="mb-1.5 block text-sm"
          >
            Plus-one name{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id={`plusone-${guest.id}`}
            value={plusOneName}
            onChange={(e) => setPlusOneName(e.target.value)}
            placeholder="e.g. Tom Johnson"
            className="text-base"
          />
        </div>
      </div>
    </EntitySheet>
  );
}

// ── Payment milestone row ────────────────────────────────────────────────────

function PaymentRow({ milestone }: { milestone: PaymentMilestone }) {
  const isPaid = milestone.status === "paid";
  const isOverdue = milestone.status === "overdue";
  const isDue = milestone.status === "due";

  return (
    <Card
      className={cn(
        "transition-all",
        !isPaid && "hover:-translate-y-0.5 hover:shadow-md",
      )}
    >
      <CardContent className="flex items-center gap-4 py-4">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            isPaid
              ? "bg-fun-green/60"
              : isOverdue
                ? "bg-destructive/10"
                : isDue
                  ? "bg-warning/60"
                  : "bg-muted",
          )}
        >
          {isPaid ? (
            <CheckCircle2 className="size-4 text-fun-green-strong" />
          ) : isOverdue ? (
            <AlertCircle className="size-4 text-destructive" />
          ) : (
            <Clock
              className={cn(
                "size-4",
                isDue ? "text-warning-foreground" : "text-muted-foreground",
              )}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{milestone.label}</p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {isPaid && milestone.paidOn
              ? `Paid ${formatDate(milestone.paidOn)}`
              : `Due ${formatDate(milestone.dueDate)}`}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {gbpFmt(milestone.amount)}
          </p>
          <Badge
            variant={
              isPaid
                ? "success"
                : isOverdue
                  ? "destructive"
                  : isDue
                    ? "warning"
                    : "secondary"
            }
            className="text-[10px]"
          >
            {isPaid ? "Paid" : isOverdue ? "Overdue" : isDue ? "Due now" : "Upcoming"}
          </Badge>
        </div>

        {/* Receipt download */}
        {isPaid && milestone.receiptUrl && (
          <button
            onClick={() =>
              toast.info("Downloading receipt…", {
                description:
                  "In the live product, your receipt PDF would open here.",
              })
            }
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Download receipt for ${milestone.label}`}
          >
            <Download className="size-3.5" />
          </button>
        )}

        {/* Pay CTA for due/overdue */}
        {!isPaid && (isDue || isOverdue) && (
          <Button
            size="sm"
            className="shrink-0 min-h-[36px]"
            onClick={() =>
              toast.success("Redirecting to payment…", {
                description: "In the live product, this opens your secure payment page.",
              })
            }
          >
            Pay
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Document row ──────────────────────────────────────────────────────────────

const DOC_STATUS_BADGE: Record<string, { label: string; variant: "success" | "warning" | "secondary" | "destructive" }> = {
  signed: { label: "Signed", variant: "success" },
  received: { label: "Received", variant: "success" },
  sent: { label: "Sent", variant: "warning" },
  draft: { label: "Draft", variant: "secondary" },
  missing: { label: "Missing", variant: "destructive" },
};

function DocRow({ doc }: { doc: WeddingDoc }) {
  const badge = DOC_STATUS_BADGE[doc.status] ?? { label: doc.status, variant: "secondary" as const };

  return (
    <div className="flex min-h-[44px] items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5 ring-1 ring-border/50">
      <FileText className="size-4 shrink-0 text-muted-foreground" />
      <p className="flex-1 text-sm font-medium text-foreground">{doc.name}</p>
      <Badge variant={badge.variant} className="text-[10px]">
        {badge.label}
      </Badge>
      {(doc.status === "signed" || doc.status === "received") && (
        <button
          onClick={() =>
            toast.info("Opening document…", {
              description: "In the live product, this opens the document for download.",
            })
          }
          className="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={`Download ${doc.name}`}
        >
          <ExternalLink className="size-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isOutbound = msg.direction === "in"; // couple = "in" direction (they send to venue)
  const chanIcon = CHANNEL_ICON[msg.channel] ?? "✉";

  return (
    <div
      className={cn(
        "flex max-w-[85%] flex-col gap-1",
        isOutbound ? "ml-auto items-end" : "mr-auto items-start",
      )}
    >
      {/* Author + channel */}
      <p className="text-[10px] font-medium text-muted-foreground">
        {msg.author} &middot; {chanIcon} {formatMessageDate(msg.at)}
      </p>
      {/* Bubble */}
      <div
        className={cn(
          "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isOutbound
            ? "rounded-br-sm bg-fun-pink/40 text-foreground"
            : "rounded-bl-sm bg-muted text-foreground",
        )}
      >
        {msg.body}
      </div>
    </div>
  );
}
