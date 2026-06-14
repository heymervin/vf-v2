import { PageHeader } from "@/components/layout/page-header";
import { CONTACTS, CONTACTS as ALL_CONTACTS } from "@/lib/mock";
import { STAGES } from "@/lib/pipeline";
import { PipelineBoard } from "./pipeline-board";

export const metadata = { title: "Pipeline" };

export default function PipelinePage() {
  // Pre-group contacts by stage so the client component receives a stable,
  // typed map — no repeated filter loops in the browser.
  const columnData = STAGES.map((stage) => ({
    stage,
    contacts: CONTACTS.filter((c) => c.stage === stage.value),
  }));

  const totalCount = ALL_CONTACTS.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mx-auto w-full max-w-[1400px] px-0">
        <PageHeader
          title="Pipeline"
          subtitle="The 8-stage sales spine — every enquiry from first contact to booked wedding."
        />
      </div>

      {/*
        PipelineBoard owns the horizontal-scroll region and the search filter.
        It must be full-bleed (not constrained to 1400px) so columns fill the
        viewport; the max-width only constrains the header above.
      */}
      <PipelineBoard columnData={columnData} totalCount={totalCount} />
    </div>
  );
}
