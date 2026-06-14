import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { loadTeam } from "./actions";
import { TeamManager } from "./team-manager";

export const metadata = { title: "Team" };

export default async function TeamSettingsPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const result = await loadTeam();

  return (
    <div className="mx-auto max-w-[680px]">
      <Link
        href="/settings"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Settings
      </Link>

      <h1 className="text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
        Team
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Invite teammates and manage who can access this venue. Only the owner can
        change roles or remove people.
      </p>

      {result.ok ? (
        <TeamManager
          members={result.data.members}
          invites={result.data.invites}
          canManage={result.data.canManage}
        />
      ) : (
        <p className="mt-8 text-sm text-destructive">{result.error}</p>
      )}
    </div>
  );
}
