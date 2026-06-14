import Link from "next/link";
import { Heart, MapPin, Users, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  WEDDINGS,
  gbp,
  daysFromToday,
  formatLongDate,
  type Wedding,
} from "@/lib/mock";

export const metadata = { title: "Weddings" };

function statusVariant(
  status: Wedding["status"],
): "outline" | "warning" | "pink" | "success" {
  switch (status) {
    case "planning":
      return "outline";
    case "final_details":
      return "warning";
    case "this_week":
      return "pink";
    case "completed":
      return "success";
  }
}

function statusLabel(status: Wedding["status"]): string {
  switch (status) {
    case "planning":
      return "Planning";
    case "final_details":
      return "Final details";
    case "this_week":
      return "This week";
    case "completed":
      return "Completed";
  }
}

function CountdownChip({ iso }: { iso: string }) {
  const days = daysFromToday(iso);
  if (days < 0) {
    return (
      <span className="text-xs font-medium tabular-nums text-muted-foreground">
        Completed
      </span>
    );
  }
  return (
    <span className="text-xs font-medium tabular-nums text-muted-foreground">
      <span className="font-semibold text-foreground">{days}</span> days to go
    </span>
  );
}

export default function WeddingsPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Weddings"
        subtitle="Every booked wedding workspace — plans, payments, and planning tools in one place."
      />

      {WEDDINGS.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Heart className="mb-4 size-10 text-fun-pink-strong" />
            <p className="text-base font-semibold text-foreground">
              No booked weddings yet
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              When a couple moves to{" "}
              <span className="font-medium">Wedding booked</span> in the
              pipeline, their workspace appears here.
            </p>
            <Link
              href="/preview/pipeline"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Open pipeline <ArrowRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {WEDDINGS.map((w) => {
            const paidPct = Math.round((w.paid / w.totalValue) * 100);
            return (
              <Link
                key={w.id}
                href={`/preview/weddings/${w.id}`}
                className="group"
              >
                <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="flex flex-col gap-4">
                    {/* Top row: couple name + status badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fun-pink text-sm font-semibold text-fun-pink-foreground">
                          {w.coupleName
                            .split(" & ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold leading-tight text-foreground">
                            {w.coupleName}
                          </p>
                          <CountdownChip iso={w.date} />
                        </div>
                      </div>
                      <Badge variant={statusVariant(w.status)} className="shrink-0">
                        {statusLabel(w.status)}
                      </Badge>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Heart className="size-3.5 text-fun-pink-strong" />
                        <span className="tabular-nums font-medium text-foreground">
                          {formatLongDate(w.date)}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="size-3.5" />
                        {w.space}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="size-3.5" />
                        {w.guestCount} guests
                      </span>
                    </div>

                    {/* Payment progress */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Paid</span>
                        <span className="tabular-nums font-medium text-foreground">
                          {gbp(w.paid)}{" "}
                          <span className="text-muted-foreground font-normal">
                            of {gbp(w.totalValue)}
                          </span>
                        </span>
                      </div>
                      <Progress value={paidPct} className="h-1.5" />
                      <p className="text-right text-[11px] tabular-nums text-muted-foreground">
                        {paidPct}% paid
                      </p>
                    </div>

                    {/* Arrow hint */}
                    <div className="flex items-center justify-end gap-1 text-xs font-medium text-primary">
                      Open workspace
                      <ArrowRight className="size-3.5 -translate-x-0.5 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
