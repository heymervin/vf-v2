import { PageHeader } from "@/components/layout/page-header";
import { CopilotTriage } from "./copilot-triage";

export const metadata = { title: "Copilot" };

export default function CopilotPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Copilot"
        subtitle="Ranked by priority. Act on what matters — ask anything with ⌘K."
        shimmer={false}
      />

      <div className="max-w-2xl">
        <CopilotTriage />
      </div>
    </div>
  );
}
