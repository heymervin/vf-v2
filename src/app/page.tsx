import { Button } from "@/components/ui/button";

// Fixed stage-chip mapping per DESIGN.md: pastel bg + navy text, one hue per stage.
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
          <p className="text-xs font-semibold tracking-[0.08em] uppercase text-muted-foreground">
            The Wedding Marketers
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.022em] text-foreground">
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
          <p className="text-xs font-semibold tracking-[0.08em] uppercase text-muted-foreground">
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
