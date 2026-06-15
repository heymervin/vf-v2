import Link from "next/link";
import { Heart, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { WEDDINGS } from "@/lib/mock";
import { WeddingsClient } from "./weddings-client";

export const metadata = { title: "Weddings" };

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
        <WeddingsClient weddings={WEDDINGS} />
      )}
    </div>
  );
}
