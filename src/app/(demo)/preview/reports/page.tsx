import { PageHeader } from "@/components/layout/page-header";
import { REPORTS } from "@/lib/mock";
import { ReportsCharts } from "./reports-charts";

export const metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Reports"
        subtitle="The full lifecycle in one view — lead source → conversion → revenue → delivery. Neither GoHighLevel nor Sonas reports end to end."
      />

      <ReportsCharts
        funnel={REPORTS.funnel}
        revenueByMonth={REPORTS.revenueByMonth}
        sourceRoi={REPORTS.sourceRoi}
      />
    </div>
  );
}
