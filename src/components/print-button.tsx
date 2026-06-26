"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Triggers the browser print dialog. Pair with a print-isolation @media block. */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button size="sm" onClick={() => window.print()}>
      <Printer /> {label}
    </Button>
  );
}
