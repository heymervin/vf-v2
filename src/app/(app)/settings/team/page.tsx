import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { listTeamMembers } from "./actions";
import { TeamManager } from "./team-manager";

export const metadata = { title: "Team & roles" };

export default async function TeamSettingsPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  // Only owners and admins can view the team page
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    redirect("/settings");
  }

  const result = await listTeamMembers();

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-[780px]">
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[780px]">
      <Link
        href="/settings"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Settings
      </Link>

      <h1 className="text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
        Team &amp; roles
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Invite your team, assign roles, and manage who has access to VenueFlow.
      </p>

      <div className="mt-8">
        <TeamManager
          members={result.data}
          currentUserId={ctx.user.id}
          isOwner={ctx.role === "owner"}
        />
      </div>
    </div>
  );
}
