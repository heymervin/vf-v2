/**
 * /preview/admin/team — Team & roles
 *
 * Rendered inside the admin SettingsShell (built by the shell agent).
 * This file owns only the content pane: no shell, no PageHeader.
 *
 * Sections:
 *   1. SortableTable of TEAM members with DataToolbar (search + status filter)
 *      + "Invite member" EntitySheet + per-row actions (resend / disable / enable)
 *   2. Read-only permission matrix: roles as columns, capabilities as rows.
 */

import { TEAM } from "@/lib/mock"
import { ROLES, ROLE_PERMISSIONS } from "@/lib/mock/admin"
import { TeamClient } from "./team-client"

export const metadata = { title: "Team & roles — VenueFlow Admin" }

/**
 * The mock TEAM has 3 active members. We extend the list in this server
 * component (no mutation to the mock module) to give the demo a realistic
 * spread of statuses (invited + disabled).
 */
const EXTENDED_TEAM = [
  ...TEAM.map((m) => ({
    ...m,
    email: m.email ?? `${m.initials.toLowerCase().replace("", ".")}@theoldbarn.co.uk`,
    status: (m.status ?? "active") as "active" | "invited" | "disabled",
    roleKey: m.roleKey ?? "member",
    lastActive: m.id === "u1"
      ? "Today, 9:41 am"
      : m.id === "u2"
      ? "Yesterday, 3:18 pm"
      : "12 Jun 2026",
  })),
  // Invited — not yet accepted
  {
    id: "u4",
    name: "Sophie Turner",
    initials: "ST",
    role: "Member",
    email: "sophie@theoldbarn.co.uk",
    status: "invited" as const,
    roleKey: "member",
    lastActive: null,
  },
  // Disabled — left the venue
  {
    id: "u5",
    name: "James Griffiths",
    initials: "JG",
    role: "Coordinator",
    email: "james.g@theoldbarn.co.uk",
    status: "disabled" as const,
    roleKey: "coordinator",
    lastActive: "2 Apr 2026",
  },
]

export default function TeamAdminPage() {
  return (
    <TeamClient
      members={EXTENDED_TEAM}
      roles={ROLES}
      rolePermissions={ROLE_PERMISSIONS}
    />
  )
}
