import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FileText,
  Code2,
  Mail,
  CalendarDays,
  CreditCard,
  ChevronRight,
  Zap,
  Building2,
  Package,
  Utensils,
  Users,
  SlidersHorizontal,
  CheckCircle2,
  Circle,
  Lock,
} from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeSetupChecklist,
  type ChecklistStep,
} from "@/lib/gating/checklist";

export const metadata = { title: "Settings" };

// ── setup checklist ────────────────────────────────────────────────────────────

const STEP_LINKS: Record<string, string> = {
  profile: "/settings/profile",
  spaces: "/settings/spaces",
  floor_templates: "/settings/spaces",
  menu_library: "/settings/menu",
  packages: "/settings/packages",
  team: "/settings/team",
  ghl: "/settings/ghl",
};

function SetupChecklist({ steps }: { steps: ChecklistStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  if (allDone) return null;

  return (
    <div className="mb-8 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-foreground">Set up your venue</p>
          <p className="text-sm text-muted-foreground">
            {doneCount} of {steps.length} steps complete
          </p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
          {doneCount}/{steps.length}
        </div>
      </div>

      {/* progress bar */}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground transition-all"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>

      <ul className="space-y-2">
        {steps.map((step) => {
          const href = STEP_LINKS[step.key] ?? "/settings";
          return (
            <li key={step.key}>
              <Link
                href={href}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent/40"
              >
                {step.done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span
                  className={
                    step.done
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  }
                >
                  {step.label}
                </span>
                {step.unlocks.length > 0 && !step.done && (
                  <Lock className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── section tiles ──────────────────────────────────────────────────────────────

type TileSection = {
  heading: string;
  tiles: Array<{
    href: string;
    icon: React.ElementType;
    title: string;
    desc: string;
  }>;
};

const VENUE_IDENTITY: TileSection = {
  heading: "Venue identity",
  tiles: [
    {
      href: "/settings/profile",
      icon: Building2,
      title: "Profile & brand",
      desc: "Venue name, logo, accent colour, address and opening hours.",
    },
    {
      href: "/settings/spaces",
      icon: Building2,
      title: "Spaces",
      desc: "Add and manage bookable spaces — barns, orangeries, courtyards. Each gets its own floor-plan template.",
    },
    {
      href: "/settings/packages",
      icon: Package,
      title: "Packages & pricing",
      desc: "Define packages and add-ons. Prices flow directly into the proposal builder.",
    },
    {
      href: "/settings/menu",
      icon: Utensils,
      title: "Menu library",
      desc: "Manage your reusable dish catalogue. Active dishes are available when building per-wedding menus.",
    },
    {
      href: "/settings/custom-fields",
      icon: SlidersHorizontal,
      title: "Custom fields",
      desc: "Capture venue-specific info on contacts and weddings (capped at 12).",
    },
  ],
};

const TEAM: TileSection = {
  heading: "Team",
  tiles: [
    {
      href: "/settings/team",
      icon: Users,
      title: "Team & roles",
      desc: "Invite team members, assign roles, and manage access.",
    },
  ],
};

const INTEGRATIONS: TileSection = {
  heading: "Integrations",
  tiles: [
    {
      href: "/settings/ghl",
      icon: Zap,
      title: "VenueFlow",
      desc: "Connect your VenueFlow account to sync contacts and pipeline data.",
    },
  ],
};

const STANDALONE_CRM: TileSection = {
  heading: "Standalone CRM",
  tiles: [
    {
      href: "/settings/forms",
      icon: Code2,
      title: "Enquiry form",
      desc: "Your public form link and the embed code for your website.",
    },
    {
      href: "/settings/brochure",
      icon: FileText,
      title: "Brochure",
      desc: "Upload the PDF that's auto-emailed to every new enquiry.",
    },
    {
      href: "/settings/sequences",
      icon: Mail,
      title: "Nurture sequence",
      desc: "Edit the 3-step follow-up email sequence sent to new enquiries.",
    },
  ],
};

const PLATFORM: TileSection = {
  heading: "Platform",
  tiles: [
    {
      href: "/settings/availability",
      icon: CalendarDays,
      title: "Availability",
      desc: "Set staff availability windows and tune meeting type durations.",
    },
    {
      href: "/settings/billing",
      icon: CreditCard,
      title: "Billing",
      desc: "Manage your VenueFlow subscription and payment details.",
    },
  ],
};

function TileGroup({ section }: { section: TileSection }) {
  return (
    <section>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {section.heading}
      </p>
      <ul className="space-y-3">
        {section.tiles.map((tile) => (
          <li key={tile.href}>
            <Link
              href={tile.href}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-accent/40"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <tile.icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{tile.title}</p>
                <p className="text-sm text-muted-foreground">{tile.desc}</p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── page ───────────────────────────────────────────────────────────────────────

export default async function SettingsPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const venueId = ctx.venue.id;

  // Fetch all counts in parallel — head-only queries, minimal data transfer
  const supabase = await createClient();
  const admin = createAdminClient();

  const [
    spacesResult,
    floorTemplatesResult,
    menuItemsResult,
    packagesResult,
    teamMembersResult,
    ghlCredsResult,
    venueRow,
  ] = await Promise.all([
    supabase
      .from("spaces")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId)
      .eq("is_archived", false),
    supabase
      .from("floor_templates")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId),
    supabase
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId)
      .eq("is_active", true),
    supabase
      .from("packages")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId)
      .eq("is_active", true),
    supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId),
    // ghl_credentials is service-role only — authenticated client won't see the row
    admin
      .from("ghl_credentials")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId),
    supabase
      .from("venues")
      .select("name, logo_path, timezone, mode")
      .eq("id", venueId)
      .single(),
  ]);

  // Derive checklist state from DB counts
  const profileComplete =
    !!venueRow.data?.name &&
    !!venueRow.data?.logo_path &&
    !!venueRow.data?.timezone;

  const checklistSteps = computeSetupChecklist({
    profileComplete,
    spaces: spacesResult.count ?? 0,
    floorTemplates: floorTemplatesResult.count ?? 0,
    menuItems: menuItemsResult.count ?? 0,
    packages: packagesResult.count ?? 0,
    teamMembers: teamMembersResult.count ?? 0,
    ghlConnected: (ghlCredsResult.count ?? 0) > 0,
  });

  // Show standalone CRM tiles only when venue is NOT in bundled mode
  const isStandaloneMode = venueRow.data?.mode !== "bundled";

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
          Settings
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Configure your venue — spaces, menus, packages, team, and integrations.
        </p>
      </div>

      <SetupChecklist steps={checklistSteps} />

      <div className="space-y-8">
        <TileGroup section={VENUE_IDENTITY} />
        <TileGroup section={TEAM} />
        <TileGroup section={INTEGRATIONS} />
        {isStandaloneMode && <TileGroup section={STANDALONE_CRM} />}
        <TileGroup section={PLATFORM} />
      </div>
    </div>
  );
}
