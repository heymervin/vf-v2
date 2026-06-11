import { Button } from "@/components/ui/button";

const stages = [
  { name: "Inbound enquiry", bg: "bg-fun-blue/40", fg: "text-fun-blue-strong" },
  { name: "Responded", bg: "bg-fun-teal/40", fg: "text-fun-teal-strong" },
  { name: "Viewing interest", bg: "bg-fun-teal/25", fg: "text-fun-teal-strong" },
  { name: "Appointment booked", bg: "bg-fun-blue/30", fg: "text-fun-blue-strong" },
  { name: "Appointment attended", bg: "bg-fun-pink/40", fg: "text-fun-pink-strong" },
  { name: "Date on hold", bg: "bg-warning", fg: "text-warning-foreground" },
  { name: "Wedding booked", bg: "bg-fun-green/50", fg: "text-fun-green-strong" },
  { name: "Archived", bg: "bg-muted", fg: "text-muted-foreground" },
];

export default function Home() {
  return (
    <main className="flex min-h-dvh">
      {/* Signature dark-navy rail, placeholder for the app sidebar */}
      <div className="hidden w-16 shrink-0 flex-col items-center bg-sidebar py-6 sm:flex">
        <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
          V
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center px-6 py-16 sm:px-16">
        <div className="max-w-xl">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
            The Wedding Marketers
          </p>
          <h1 className="title-shimmer-underline mt-3 text-4xl font-bold tracking-[-0.022em] text-foreground sm:text-5xl">
            VenueFlow
          </h1>
          <p className="mt-7 text-base leading-relaxed text-muted-foreground">
            The CRM built for wedding venues. Capture every enquiry, nurture
            every couple, book every viewing, and watch the pipeline move to
            wedding booked.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <Button size="lg">Get started</Button>
            <Button size="lg" variant="outline">
              See the pipeline
            </Button>
          </div>
        </div>

        <div className="mt-16 max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
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
