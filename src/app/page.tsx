import Link from "next/link";
import { ArrowRight, MessageSquare, CalendarHeart } from "lucide-react";
import { Button } from "@/components/ui/button";

// The 8-stage spine (sales) shown as a brand element.
const stages = [
  { name: "Inbound enquiry", bg: "bg-accent", fg: "text-accent-foreground" },
  { name: "Responded", bg: "bg-fun-teal", fg: "text-foreground" },
  { name: "Viewing interest", bg: "bg-mint", fg: "text-foreground" },
  { name: "Appointment booked", bg: "bg-fun-blue", fg: "text-foreground" },
  { name: "Appointment attended", bg: "bg-fun-pink", fg: "text-fun-pink-foreground" },
  { name: "Date on hold", bg: "bg-warning", fg: "text-warning-foreground" },
  { name: "Wedding booked", bg: "bg-fun-green", fg: "text-foreground" },
  { name: "Archived", bg: "bg-muted", fg: "text-muted-foreground" },
];

const halves = [
  {
    icon: MessageSquare,
    eyebrow: "Sales & marketing",
    title: "Win the booking",
    body: "Capture every enquiry, nurture across Email · SMS · WhatsApp, and move it down one opinionated pipeline.",
  },
  {
    icon: CalendarHeart,
    eyebrow: "Wedding planning",
    title: "Run the day",
    body: "Proposals, payments, run-sheets, seating, menus and a couple portal — the whole event, one record.",
  },
];

export default function Home() {
  return (
    <main className="flex min-h-dvh">
      {/* Signature dark-navy rail */}
      <div className="hidden w-16 shrink-0 flex-col items-center justify-between bg-sidebar py-6 sm:flex">
        <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
          V
        </div>
        <Link
          href="/login"
          className="rotate-180 text-[11px] font-medium uppercase tracking-[0.15em] text-sidebar-foreground/60 hover:text-sidebar-foreground [writing-mode:vertical-rl]"
        >
          Log in
        </Link>
      </div>

      <div className="flex flex-1 flex-col justify-center px-6 py-14 sm:px-16">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            The Wedding Marketers
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.022em] text-foreground sm:text-5xl">
            VenueFlow
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            One platform for the whole wedding — the sales engine that wins the
            booking <span className="text-foreground">and</span> the planning
            tools that run the day. The productized replacement for GoHighLevel
            and Sonas.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" asChild>
              <Link href="/preview">
                Explore the platform
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Link
              href="/portal"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              For couples — open the portal →
            </Link>
          </div>
        </div>

        {/* The two halves, united */}
        <div className="mt-14 grid max-w-3xl gap-4 sm:grid-cols-2">
          {halves.map((h) => {
            const Icon = h.icon;
            return (
              <div
                key={h.eyebrow}
                className="rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </span>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {h.eyebrow}
                </p>
                <p className="mt-1 font-semibold text-foreground">{h.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {h.body}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Eight stages, one source of truth
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {stages.map((stage) => (
              <span
                key={stage.name}
                className={`inline-flex h-7 items-center rounded-full px-3 text-xs font-medium ${stage.bg} ${stage.fg}`}
              >
                {stage.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
