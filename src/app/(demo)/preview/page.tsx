import Link from "next/link";
import {
  MessageSquare,
  Kanban,
  Users,
  Banknote,
  Heart,
  Clock,
  Grid3x3,
  UserCheck,
  Utensils,
  Truck,
  Sparkles,
  BarChart3,
  ArrowRight,
  Check,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { REPORTS, COPILOT_INSIGHTS, WEDDINGS, gbp, getContact, formatLongDate } from "@/lib/mock";

export const metadata = { title: "Overview" };

const BANDS = [
  {
    label: "Sales & Marketing",
    tag: "absorbs GoHighLevel",
    blurb: "Capture, nurture and book — across Email, SMS & WhatsApp.",
    modules: [
      { label: "Unified Inbox", href: "/preview/inbox", icon: MessageSquare, desc: "Email · SMS · WhatsApp in one thread" },
      { label: "Pipeline", href: "/preview/pipeline", icon: Kanban, desc: "The fixed 8-stage kanban spine" },
      { label: "Contacts", href: "/preview/contacts", icon: Users, desc: "Every couple, full timeline" },
    ],
  },
  {
    label: "Booking & Money",
    tag: "the bridge",
    blurb: "Proposals, e-sign and payment schedules where lock-in begins.",
    modules: [
      { label: "Proposals & Payments", href: "/preview/money", icon: Banknote, desc: "Quotes, contracts, milestone payments" },
    ],
  },
  {
    label: "Wedding Planning",
    tag: "beats Sonas",
    blurb: "Everything after the booking — a generation newer.",
    modules: [
      { label: "Weddings", href: "/preview/weddings", icon: Heart, desc: "The Wedding Workspace hub" },
      { label: "Run-sheet", href: "/preview/runsheet", icon: Clock, desc: "The day's timeline" },
      { label: "Floor plan", href: "/preview/floorplan", icon: Grid3x3, desc: "Tables & seating" },
      { label: "Guests", href: "/preview/guests", icon: UserCheck, desc: "RSVPs & dietary" },
      { label: "Menu", href: "/preview/menu", icon: Utensils, desc: "Choices & allergen rollup" },
      { label: "Suppliers", href: "/preview/suppliers", icon: Truck, desc: "Vendors & documents" },
    ],
  },
  {
    label: "Intelligence",
    tag: "neither competitor has this",
    blurb: "AI across the whole lifecycle, plus end-to-end reporting.",
    modules: [
      { label: "AI Copilot", href: "/preview/copilot", icon: Sparkles, desc: "Drafts, scores, flags at-risk" },
      { label: "Reports", href: "/preview/reports", icon: BarChart3, desc: "Lead source → revenue → delivery" },
    ],
  },
];

const KPIS = [
  { label: "Conversion rate", value: `${REPORTS.kpis.conversionRate}%` },
  { label: "Avg booking value", value: gbp(REPORTS.kpis.avgBookingValue) },
  { label: "Avg first response", value: `${REPORTS.kpis.avgFirstResponseMins} min` },
  { label: "Booked revenue YTD", value: gbp(REPORTS.kpis.bookedRevenueYtd) },
];

export default function OverviewPage() {
  const recentBookings = WEDDINGS.slice(0, 3);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="The whole wedding, one platform"
        subtitle="VenueFlow v2 unites the GoHighLevel-class sales engine with Sonas-class wedding planning — one record from first enquiry to event day. This is a seeded prototype; click anything in the sidebar."
      />

      {/* KPI row */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KPIS.map((k) => (
          <Card key={k.label} size="sm">
            <CardContent className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {k.label}
              </span>
              <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {k.value}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lifecycle journey strip */}
      <Card className="mb-8">
        <CardContent>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            One continuous record
          </p>
          <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
            {["Enquiry captured", "Nurtured (Email/SMS/WhatsApp)", "Viewing booked", "Proposal & e-sign", "Deposit → Booked 🎉", "Planned in the Workspace", "Event day", "Archived"].map(
              (step, i, arr) => (
                <div key={step} className="flex items-center gap-3 md:flex-1">
                  <div className="flex flex-1 items-center gap-2 rounded-lg bg-accent/50 px-3 py-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground tabular-nums">
                      {i + 1}
                    </span>
                    <span className="text-xs font-medium text-foreground">{step}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground md:block" />
                  )}
                </div>
              ),
            )}
          </div>
        </CardContent>
      </Card>

      {/* Module bands */}
      <div className="space-y-8">
        {BANDS.map((band) => (
          <section key={band.label}>
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">{band.label}</h2>
              <Badge variant="pink">{band.tag}</Badge>
              <span className="text-sm text-muted-foreground">{band.blurb}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {band.modules.map((m) => {
                const Icon = m.icon;
                return (
                  <Link key={m.href} href={m.href} className="group">
                    <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
                      <CardContent className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                          <Icon className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1 font-medium text-foreground">
                            {m.label}
                            <ArrowRight className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                          </p>
                          <p className="text-sm text-muted-foreground">{m.desc}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Today snapshot */}
      <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent>
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="size-4 text-fun-pink-strong" />
              <h2 className="text-base font-semibold text-foreground">Copilot — today</h2>
            </div>
            <ul className="space-y-3">
              {COPILOT_INSIGHTS.slice(0, 4).map((ins) => (
                <li key={ins.id} className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-fun-pink-strong" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{ins.title}</p>
                    <p className="text-sm text-muted-foreground">{ins.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/preview/copilot" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Open Copilot <ArrowRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="mb-3 flex items-center gap-2">
              <Heart className="size-4 text-fun-pink-strong" />
              <h2 className="text-base font-semibold text-foreground">Recently booked</h2>
            </div>
            <ul className="divide-y divide-border">
              {recentBookings.map((w) => {
                const c = getContact(w.contactId);
                return (
                  <li key={w.id}>
                    <Link href={`/preview/weddings/${w.id}`} className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-accent/40">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 items-center justify-center rounded-full bg-fun-pink text-xs font-semibold text-fun-pink-foreground">
                          {c?.initials ?? "♥"}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{w.coupleName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatLongDate(w.date)} · {w.guestCount} guests · {w.space}
                          </p>
                        </div>
                      </div>
                      <Badge variant={w.paid >= w.totalValue ? "success" : "outline"}>
                        {w.paid >= w.totalValue ? (
                          <><Check className="size-3" /> Paid</>
                        ) : (
                          `${Math.round((w.paid / w.totalValue) * 100)}% paid`
                        )}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link href="/preview/weddings" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              All weddings <ArrowRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
