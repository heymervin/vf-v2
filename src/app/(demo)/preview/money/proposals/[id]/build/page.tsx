import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import {
  getProposal,
  getContact,
  PROPOSALS,
  PRICE_LIBRARY,
  VENUE_BILLING,
} from "@/lib/mock";
import { ProposalBuilder } from "./_components/proposal-builder";

export const metadata = { title: "Proposal Builder" };

interface BuildPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProposalBuildPage({ params }: BuildPageProps) {
  const { id } = await params;

  // Fall back to first proposal if id unknown.
  const proposal = getProposal(id) ?? PROPOSALS[0];
  if (!proposal) notFound();

  const contact = getContact(proposal.contactId);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title={contact ? `${contact.coupleName} — Proposal` : "Proposal builder"}
        subtitle={
          contact?.weddingDate
            ? `${contact.weddingDate ? new Date(contact.weddingDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "Date TBC"} · ${contact.guestCount ?? "?"} guests`
            : "Draft proposal"
        }
      />

      <ProposalBuilder
        proposal={proposal}
        contact={contact}
        priceLibrary={PRICE_LIBRARY}
        venueBilling={VENUE_BILLING}
      />
    </div>
  );
}
