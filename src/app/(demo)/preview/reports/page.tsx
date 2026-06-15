import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { REPORTS, gbp } from "@/lib/mock";
import { ReportsCharts } from "./reports-charts";

export const metadata = { title: "Reports" };

const KPIS = [
  { label: "Conversion rate", value: `${REPORTS.kpis.conversionRate}%`, note: "enquiry → booked" },
  { label: "Avg booking value", value: gbp(REPORTS.kpis.avgBookingValue), note: "per wedding" },
  { label: "Avg first response", value: `${REPORTS.kpis.avgFirstResponseMins} min`, note: "any channel" },
  { label: "Booked revenue YTD", value: gbp(REPORTS.kpis.bookedRevenueYtd), note: "Jan – Jun 2026" },
  { label: "On-time payments", value: `${REPORTS.kpis.onTimePayments}%`, note: "auto-reminders" },
  { label: "Portal adoption", value: `${REPORTS.kpis.portalAdoption}%`, note: "booked couples" },
];

export default function ReportsPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Reports"
        subtitle="The full lifecycle in one view — lead source → conversion → revenue → delivery. Neither GoHighLevel nor Sonas reports end to end."
      />

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {KPIS.map((k) => (
          <Card key={k.label} size="sm">
            <CardContent className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {k.label}
              </span>
              <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {k.value}
              </span>
              <span className="text-xs text-muted-foreground">{k.note}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <ReportsCharts
        funnel={REPORTS.funnel}
        revenueByMonth={REPORTS.revenueByMonth}
        sourceRoi={REPORTS.sourceRoi}
      />
    </div>
  );
}
