import { notFound, redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { PageHeader } from "@/components/layout/page-header";
import { getProposalWithDetails, getPriceLibrary } from "./actions";
import { ProposalBuilder } from "./proposal-builder";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return { title: `Proposal ${id.slice(0, 8)} — Builder` };
}

interface BuildPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProposalBuildPage({ params }: BuildPageProps) {
  const { id } = await params;

  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const [detailsResult, libraryResult] = await Promise.all([
    getProposalWithDetails(id),
    getPriceLibrary(),
  ]);

  if (!detailsResult.ok) notFound();

  const { proposal, lineItems, wedding } = detailsResult.data;
  const packages = libraryResult.ok ? libraryResult.data.packages : [];
  const menuItems = libraryResult.ok ? libraryResult.data.menuItems : [];

  const subtitle = wedding
    ? [
        wedding.couple_names,
        wedding.wedding_date
          ? new Date(wedding.wedding_date).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : "Date TBC",
        wedding.guest_count_day != null ? `${wedding.guest_count_day} guests` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Draft proposal";

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Proposal builder" subtitle={subtitle} />

      <ProposalBuilder
        proposal={proposal}
        lineItems={lineItems}
        packages={packages}
        menuItems={menuItems}
        wedding={wedding}
      />
    </div>
  );
}
