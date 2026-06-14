"use client";

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
import { cn } from "@/lib/utils";
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
  Heart,
  Sparkles,
} from "lucide-react";

// ---- types mirrored from @/lib/mock (no import-only-types constraint needed here) ----

interface PaymentMilestone {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
  status: "paid" | "due" | "upcoming" | "overdue";
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
}

interface MenuCourse {
  id: string;
  course: string;
  options: MenuOption[];
}

interface Guest {
  id: string;
  name: string;
  rsvp: "yes" | "no" | "pending";
}

interface RunsheetItem {
  id: string;
  time: string;
  title: string;
  category: "ceremony" | "reception" | "catering" | "supplier" | "logistics";
}

// ---- Prop shape ----

interface PortalClientProps {
  partner1First: string;
  partner2First: string;
  venueName: string;
  daysUntil: number;
  weddingDate: string; // formatted long date
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
}

// ---- Small helpers ----

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

const MILESTONE_CATEGORY_LABELS: Record<WeddingTask["category"], string> = {
  money: "Payment",
  planning: "Planning",
  suppliers: "Suppliers",
  admin: "Admin",
};

const COUPLE_TASK_PHRASES: Record<string, string> = {
  "Menu tasting booked": "Book your menu tasting",
  "Interim payment due": "Pay your interim instalment",
  "Final guest numbers": "Confirm your final guest numbers",
  "Confirm florist": "Lock in your florist",
  "Final balance due": "Pay your final balance",
};

function friendlyTaskLabel(raw: string): string {
  return COUPLE_TASK_PHRASES[raw] ?? raw;
}

const RUNSHEET_HIGHLIGHTS = [
  "ceremony",
  "reception",
  "catering",
] as const;

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  ceremony: <Heart className="size-4 text-fun-pink-strong" />,
  reception: <Sparkles className="size-4 text-fun-teal-strong" />,
  catering: <UtensilsCrossed className="size-4 text-fun-blue-strong" />,
};

const COUPLE_RUNSHEET_KEYWORDS = [
  "ceremony",
  "drinks reception",
  "wedding breakfast",
  "speeches",
  "first dance",
  "evening",
  "carriages",
];

function isHighlight(item: RunsheetItem): boolean {
  const titleLower = item.title.toLowerCase();
  return (
    RUNSHEET_HIGHLIGHTS.includes(
      item.category as (typeof RUNSHEET_HIGHLIGHTS)[number]
    ) &&
    COUPLE_RUNSHEET_KEYWORDS.some((kw) => titleLower.includes(kw))
  );
}

// ---- Main component ----

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
  guests,
  runsheet,
  totalValue,
  paid,
}: PortalClientProps) {
  const rsvpYes = guests.filter((g) => g.rsvp === "yes").length;
  const rsvpPending = guests.filter((g) => g.rsvp === "pending").length;
  const rsvpPct = guests.length > 0 ? Math.round((rsvpYes / guests.length) * 100) : 0;

  const paidPct = totalValue > 0 ? Math.round((paid / totalValue) * 100) : 0;
  const balance = totalValue - paid;

  const highlightItems = runsheet.filter(isHighlight);

  return (
    <>
      <Toaster position="bottom-center" />

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <div className="mb-10 rounded-2xl bg-fun-pink/30 px-7 py-10 ring-1 ring-fun-pink-strong/20">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Welcome back
        </p>
        <h1 className="mb-1 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Hi {partner1First} &amp; {partner2First}
        </h1>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Your big day
            </p>
            <p className="mt-0.5 text-lg font-medium tabular-nums text-foreground">
              {weddingDate}
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

        {/* Venue name strip */}
        <p className="mt-5 text-sm font-medium text-muted-foreground">
          at{" "}
          <span className="font-semibold text-foreground">{venueName}</span>
        </p>
      </div>

      {/* ── TABS ──────────────────────────────────────────────────────── */}
      <Tabs defaultValue="todo" className="gap-6">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1.5 sm:h-9 sm:flex-nowrap">
          <TabsTrigger value="todo" className="min-h-[36px] gap-1.5">
            <CheckCircle2 className="size-3.5" />
            To-do
            {coupleTasks.length > 0 && (
              <span className="ml-1 rounded-full bg-fun-pink-strong/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-fun-pink-strong">
                {coupleTasks.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="payments" className="min-h-[36px] gap-1.5">
            <CreditCard className="size-3.5" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="contract" className="min-h-[36px] gap-1.5">
            <FileText className="size-3.5" />
            Contract
          </TabsTrigger>
          <TabsTrigger value="menu" className="min-h-[36px] gap-1.5">
            <UtensilsCrossed className="size-3.5" />
            Menu
          </TabsTrigger>
          <TabsTrigger value="guests" className="min-h-[36px] gap-1.5">
            <Users className="size-3.5" />
            Guests
          </TabsTrigger>
          <TabsTrigger value="timeline" className="min-h-[36px] gap-1.5">
            <Calendar className="size-3.5" />
            Your day
          </TabsTrigger>
        </TabsList>

        {/* ── TO-DO ──────────────────────────────────────────────────── */}
        <TabsContent value="todo">
          <Card>
            <CardHeader>
              <CardTitle>Things to take care of</CardTitle>
              <CardDescription>
                We&apos;ll keep this list updated as your wedding gets closer.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pb-6">
              {coupleTasks.length === 0 ? (
                <div className="rounded-lg bg-fun-green/40 px-5 py-6 text-center">
                  <CheckCircle2 className="mx-auto mb-2 size-8 text-fun-green-strong" />
                  <p className="font-medium text-foreground">
                    You&apos;re all caught up!
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Nothing outstanding right now — enjoy the calm before the big day.
                  </p>
                </div>
              ) : (
                coupleTasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PAYMENTS ──────────────────────────────────────────────── */}
        <TabsContent value="payments">
          <div className="flex flex-col gap-4">
            {/* Summary bar */}
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

            {/* Pay balance CTA */}
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
          <Card>
            <CardHeader>
              <CardTitle>Booking contract</CardTitle>
              <CardDescription>
                Your agreement with {venueName}.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              {contractStatus === "signed" ? (
                <div className="flex items-start gap-4 rounded-xl bg-fun-green/40 p-5">
                  <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-fun-green-strong" />
                  <div>
                    <p className="font-semibold text-foreground">
                      Contract signed
                    </p>
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
        </TabsContent>

        {/* ── MENU ──────────────────────────────────────────────────── */}
        <TabsContent value="menu">
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Your wedding menu</CardTitle>
                <CardDescription>
                  Choices have been noted by our catering team. Let us know if
                  anything changes.
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-6">
                {menu.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Menu choices haven&apos;t been set yet — your coordinator will be in touch.
                  </p>
                ) : (
                  <div className="flex flex-col gap-6">
                    {menu.map((course) => (
                      <MenuCourseBlock key={course.id} course={course} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              variant="outline"
              onClick={() =>
                toast.info("Message sent to catering team", {
                  description:
                    "In the live product, this opens a menu amendment request.",
                })
              }
            >
              Request a menu change
            </Button>
          </div>
        </TabsContent>

        {/* ── GUESTS ────────────────────────────────────────────────── */}
        <TabsContent value="guests">
          <Card>
            <CardHeader>
              <CardTitle>Your guest list</CardTitle>
              <CardDescription>
                RSVPs are coming in — here&apos;s where you stand.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              <div className="mb-5 grid grid-cols-3 gap-3 sm:grid-cols-3">
                <StatTile
                  label="Confirmed"
                  value={rsvpYes}
                  colour="fun-green"
                />
                <StatTile
                  label="Pending"
                  value={rsvpPending}
                  colour="warning"
                />
                <StatTile
                  label="Invited"
                  value={guests.length}
                  colour="fun-blue"
                />
              </div>

              {guests.length > 0 && (
                <div className="mb-4">
                  <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                    <span>RSVP progress</span>
                    <span className="tabular-nums">
                      {rsvpPct}% responded
                    </span>
                  </div>
                  <Progress
                    value={rsvpPct}
                    indicatorClassName="bg-fun-green-strong"
                    className="h-2.5"
                  />
                </div>
              )}

              <Button
                onClick={() =>
                  toast.info("Opening guest list…", {
                    description:
                      "In the live product, this opens your full guest management dashboard.",
                  })
                }
                className="w-full sm:w-auto"
              >
                Manage guest list
                <Users className="size-4" />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TIMELINE ──────────────────────────────────────────────── */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Your day at a glance</CardTitle>
              <CardDescription>
                The key moments — your coordinator manages all the detail behind the scenes.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              {highlightItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Your timeline is being prepared — check back soon.
                </p>
              ) : (
                <ol className="relative ml-2 border-l border-border">
                  {highlightItems.map((item, idx) => (
                    <TimelineRow key={item.id} item={item} isLast={idx === highlightItems.length - 1} />
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── MESSAGE YOUR VENUE card (always visible) ──────────────────── */}
      <div className="mt-8">
        <Card className="ring-fun-teal-strong/20">
          <CardContent className="flex flex-col items-start gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-fun-teal/60">
                <MessageCircle className="size-5 text-fun-teal-strong" />
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  Message your venue
                </p>
                <p className="text-sm text-muted-foreground">
                  Got a question? Your coordinator replies within a few hours.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() =>
                toast.success("Message sent!", {
                  description:
                    "Your coordinator will be in touch within a few hours.",
                })
              }
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

// ── Sub-components ──────────────────────────────────────────────────────────

function TaskRow({ task }: { task: WeddingTask }) {
  const categoryLabel = MILESTONE_CATEGORY_LABELS[task.category];
  const friendlyLabel = friendlyTaskLabel(task.label);

  const ctaByCategory: Record<WeddingTask["category"], () => void> = {
    money: () =>
      toast.info("Opening payment…", {
        description: "In the live product, this links to your payment page.",
      }),
    planning: () =>
      toast.info("Opening planning tool…", {
        description: "In the live product, this opens the relevant planning section.",
      }),
    suppliers: () =>
      toast.info("Supplier info…", {
        description: "In the live product, this links to your suppliers list.",
      }),
    admin: () =>
      toast.info("Admin item…", {
        description: "In the live product, this links to the relevant document.",
      }),
  };

  return (
    <div
      className={cn(
        "flex min-h-[56px] items-start gap-3.5 rounded-xl px-4 py-3.5 ring-1 transition-all",
        task.done
          ? "bg-muted/40 ring-border/50"
          : "bg-card ring-border hover:-translate-y-0.5 hover:shadow-md",
      )}
    >
      <div className="mt-0.5 shrink-0">
        {task.done ? (
          <CheckCircle2 className="size-5 text-fun-green-strong" />
        ) : (
          <Circle className="size-5 text-muted-foreground/60" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-0.5">
        <p
          className={cn(
            "text-sm font-medium",
            task.done ? "text-muted-foreground line-through" : "text-foreground",
          )}
        >
          {friendlyLabel}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {categoryLabel}
          </Badge>
          {task.dueDate && !task.done && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
              <Clock className="size-3" />
              Due {formatDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>
      {!task.done && (
        <button
          onClick={ctaByCategory[task.category]}
          className="mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Take action on: ${friendlyLabel}`}
        >
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}

function PaymentRow({ milestone }: { milestone: PaymentMilestone }) {
  const isPaid = milestone.status === "paid";
  const isOverdue = milestone.status === "overdue";
  const isDue = milestone.status === "due";

  return (
    <Card
      size="sm"
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

        <div className="flex flex-1 flex-col gap-0.5">
          <p className="text-sm font-medium text-foreground">{milestone.label}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            Due {formatDate(milestone.dueDate)}
          </p>
        </div>

        <div className="text-right">
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
            className="mt-0.5 text-[10px]"
          >
            {isPaid
              ? "Paid"
              : isOverdue
                ? "Overdue"
                : isDue
                  ? "Due now"
                  : "Upcoming"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function MenuCourseBlock({ course }: { course: MenuCourse }) {
  const total = course.options.reduce((sum, o) => sum + o.chosenBy, 0);

  return (
    <div>
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {course.course}
      </p>
      <div className="flex flex-col gap-2">
        {course.options.map((opt) => {
          const pct = total > 0 ? Math.round((opt.chosenBy / total) * 100) : 0;
          return (
            <div
              key={opt.id}
              className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3 ring-1 ring-border/50"
            >
              <div className="flex flex-1 flex-col gap-1">
                <p className="text-sm font-medium text-foreground">{opt.name}</p>
                {opt.allergens.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {opt.allergens.map((a) => (
                      <Badge key={a} variant="outline" className="text-[10px]">
                        {a}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {opt.chosenBy}
                </p>
                <p className="text-[10px] tabular-nums text-muted-foreground">
                  {pct}%
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  colour,
}: {
  label: string;
  value: number;
  colour: "fun-green" | "warning" | "fun-blue";
}) {
  const bg: Record<typeof colour, string> = {
    "fun-green": "bg-fun-green/40",
    warning: "bg-warning/40",
    "fun-blue": "bg-fun-blue/40",
  };
  return (
    <div className={cn("rounded-xl px-4 py-4 text-center", bg[colour])}>
      <p className="text-2xl font-bold tabular-nums leading-none text-foreground">
        {value}
      </p>
      <p className="mt-1 text-[11px] font-medium text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function TimelineRow({
  item,
  isLast,
}: {
  item: RunsheetItem;
  isLast: boolean;
}) {
  const icon = CATEGORY_ICON[item.category] ?? (
    <Circle className="size-4 text-muted-foreground" />
  );

  return (
    <li className={cn("relative pl-6", !isLast && "pb-5")}>
      {/* dot */}
      <span className="absolute -left-[9px] flex size-[18px] items-center justify-center rounded-full bg-card ring-2 ring-border">
        {icon}
      </span>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{item.title}</p>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
          {item.time}
        </span>
      </div>
    </li>
  );
}
