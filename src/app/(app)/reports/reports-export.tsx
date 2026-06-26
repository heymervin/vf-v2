"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toCsv, downloadCsv } from "@/lib/csv";

interface ReportsExportProps {
  venueName: string;
  kpis: {
    conversionRate: number;
    bookedRevenueYtdMinor: number;
    onTimePayments: number;
    portalAdoption: number;
    avgBookingValueMinor: number;
  };
  sources: { source: string; lead_count: number }[];
  forecast: { label: string; count: number; sumMinor: number }[];
  payments: { collectedMinor: number; outstandingMinor: number; overdueMinor: number };
}

const pounds = (minor: number) => (minor / 100).toFixed(2);

export function ReportsExport({ venueName, kpis, sources, forecast, payments }: ReportsExportProps) {
  function handleExport() {
    const csv = [
      `${venueName} — Report`,
      "",
      toCsv(
        ["Metric", "Value"],
        [
          ["Conversion rate %", kpis.conversionRate],
          ["Booked revenue YTD (£)", pounds(kpis.bookedRevenueYtdMinor)],
          ["On-time payments %", kpis.onTimePayments],
          ["Portal adoption %", kpis.portalAdoption],
          ["Avg booking value (£)", pounds(kpis.avgBookingValueMinor)],
        ],
      ),
      "",
      toCsv(["Source", "Leads"], sources.map((s) => [s.source, s.lead_count])),
      "",
      toCsv(
        ["Month", "Weddings", "Forward value (£)"],
        forecast.map((f) => [f.label, f.count, pounds(f.sumMinor)]),
      ),
      "",
      toCsv(
        ["Payments", "£"],
        [
          ["Collected", pounds(payments.collectedMinor)],
          ["Outstanding", pounds(payments.outstandingMinor)],
          ["Overdue", pounds(payments.overdueMinor)],
        ],
      ),
    ].join("\n");
    downloadCsv(csv, "venueflow-report.csv");
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download /> Export CSV
    </Button>
  );
}
