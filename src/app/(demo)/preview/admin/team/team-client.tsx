"use client"

import * as React from "react"
import {
  CheckCircle2,
  Clock,
  MoreHorizontal,
  UserPlus,
  XCircle,
  RefreshCw,
  Check,
  Minus,
  ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { SortableTable, type SortableColumn } from "@/components/sortable-table"
import { DataToolbar } from "@/components/data-toolbar"
import { EntitySheet } from "@/components/entity-sheet"
import type { TeamMember } from "@/lib/mock"
import type { Role, Capability } from "@/lib/mock/admin"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MemberStatus = "active" | "invited" | "disabled"

interface RichMember extends TeamMember {
  email: string
  status: MemberStatus
  roleKey: string
  lastActive: string | null
}

interface TeamClientProps {
  members: RichMember[]
  roles: Role[]
  rolePermissions: Record<string, Record<Capability, boolean>>
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<
  MemberStatus,
  { variant: "success" | "warning" | "secondary"; label: string; Icon: React.ElementType }
> = {
  active:   { variant: "success",   label: "Active",   Icon: CheckCircle2 },
  invited:  { variant: "warning",   label: "Invited",  Icon: Clock },
  disabled: { variant: "secondary", label: "Disabled", Icon: XCircle },
}

function MemberStatusBadge({ status }: { status: MemberStatus }) {
  const { variant, label, Icon } = STATUS_MAP[status] ?? STATUS_MAP.active
  return (
    <Badge variant={variant}>
      <Icon aria-hidden />
      {label}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Capability labels (human-readable)
// ---------------------------------------------------------------------------

const CAPABILITY_META: Record<Capability, { label: string; description: string }> = {
  manage_billing:  { label: "Manage billing",   description: "Access subscription and payment settings" },
  manage_settings: { label: "Manage settings",  description: "Edit venue profile, spaces, and messaging identity" },
  manage_team:     { label: "Manage team",       description: "Invite, edit, and disable team members" },
  manage_pipeline: { label: "Manage pipeline",   description: "Move contacts through pipeline stages" },
  edit_weddings:   { label: "Edit weddings",     description: "Create and update wedding records and tasks" },
  view_reports:    { label: "View reports",      description: "Access revenue, pipeline, and source reports" },
  send_messages:   { label: "Send messages",     description: "Send emails, SMS, and WhatsApp messages" },
}

const CAPABILITY_ORDER: Capability[] = [
  "manage_billing",
  "manage_settings",
  "manage_team",
  "manage_pipeline",
  "edit_weddings",
  "view_reports",
  "send_messages",
]

// ---------------------------------------------------------------------------
// Permission matrix
// ---------------------------------------------------------------------------

function PermissionMatrix({
  roles,
  rolePermissions,
}: {
  roles: Role[]
  rolePermissions: Record<string, Record<Capability, boolean>>
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
      <table className="w-full caption-bottom text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground w-[220px] min-w-[180px]">
              Capability
            </th>
            {roles.map((role) => (
              <th
                key={role.key}
                className="h-10 px-4 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap"
              >
                {role.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CAPABILITY_ORDER.map((cap, i) => {
            const meta = CAPABILITY_META[cap]
            return (
              <tr
                key={cap}
                className={cn(
                  "border-b border-border last:border-0 transition-colors hover:bg-accent/30",
                  i % 2 === 0 ? "" : "bg-muted/20",
                )}
              >
                <td className="px-4 py-3.5 align-middle">
                  <div>
                    <p className="text-sm font-medium text-foreground">{meta.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                  </div>
                </td>
                {roles.map((role) => {
                  const allowed = rolePermissions[role.key]?.[cap] ?? false
                  return (
                    <td key={role.key} className="px-4 py-3.5 text-center align-middle">
                      {allowed ? (
                        <span
                          aria-label={`${role.name} can ${meta.label}`}
                          className="inline-flex items-center justify-center size-6 rounded-full bg-fun-green mx-auto"
                        >
                          <Check className="size-3.5 text-fun-green-strong" aria-hidden />
                        </span>
                      ) : (
                        <span
                          aria-label={`${role.name} cannot ${meta.label}`}
                          className="inline-flex items-center justify-center size-5 mx-auto"
                        >
                          <Minus className="size-4 text-muted-foreground/40" aria-hidden />
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Invite sheet form
// ---------------------------------------------------------------------------

function InviteForm({
  roles,
  onSubmit,
}: {
  roles: Role[]
  onSubmit: (data: { name: string; email: string; roleKey: string }) => void
}) {
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [roleKey, setRoleKey] = React.useState("member")

  function handleSubmit() {
    onSubmit({ name, email, roleKey })
    setName("")
    setEmail("")
    setRoleKey("member")
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="invite-name">Full name</Label>
        <Input
          id="invite-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sophie Turner"
          autoComplete="name"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="invite-email">Email address</Label>
        <Input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="sophie@theoldbarn.co.uk"
          autoComplete="email"
        />
        <p className="text-xs text-muted-foreground">
          They&apos;ll receive an invitation email to set up their account.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="invite-role">Role</Label>
        <Select value={roleKey} onValueChange={setRoleKey}>
          <SelectTrigger id="invite-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles
              .filter((r) => r.key !== "owner")
              .map((role) => (
                <SelectItem key={role.key} value={role.key}>
                  <div>
                    <p className="font-medium">{role.name}</p>
                    <p className="text-xs text-muted-foreground">{role.description}</p>
                  </div>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row actions menu
// ---------------------------------------------------------------------------

function MemberActions({
  member,
  onResend,
  onDisable,
  onEnable,
}: {
  member: RichMember
  onResend: (id: string) => void
  onDisable: (id: string) => void
  onEnable: (id: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${member.name}`}
          className="size-8 data-[state=open]:bg-accent"
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {member.status === "invited" && (
          <DropdownMenuItem onClick={() => onResend(member.id)}>
            <RefreshCw className="size-4" aria-hidden />
            Resend invite
          </DropdownMenuItem>
        )}
        {member.status !== "disabled" ? (
          <>
            {member.status === "invited" && (
              <DropdownMenuSeparator />
            )}
            <DropdownMenuItem
              onClick={() => onDisable(member.id)}
              className="text-destructive focus:text-destructive"
              disabled={member.roleKey === "owner"}
            >
              <XCircle className="size-4" aria-hidden />
              Disable access
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onClick={() => onEnable(member.id)}>
            <CheckCircle2 className="size-4" aria-hidden />
            Re-enable access
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function TeamClient({
  members: initialMembers,
  roles,
  rolePermissions,
}: TeamClientProps) {
  const [members, setMembers] = React.useState<RichMember[]>(initialMembers)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<"all" | MemberStatus>("all")

  // Invite sheet state
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [inviteKey, setInviteKey] = React.useState(0) // reset form

  // ---------- Filtering ----------
  const filtered = React.useMemo(() => {
    let list = members
    if (statusFilter !== "all") {
      list = list.filter((m) => m.status === statusFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q),
      )
    }
    return list
  }, [members, search, statusFilter])

  // ---------- Row actions ----------
  function handleResend(id: string) {
    const m = members.find((m) => m.id === id)
    toast.success(`Invite resent to ${m?.email ?? id}`)
  }

  function handleDisable(id: string) {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "disabled" } : m)),
    )
    const m = members.find((m) => m.id === id)
    toast(`${m?.name ?? "Member"} access disabled`)
  }

  function handleEnable(id: string) {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "active" } : m)),
    )
    const m = members.find((m) => m.id === id)
    toast.success(`${m?.name ?? "Member"} re-enabled`)
  }

  // ---------- Invite ----------
  function handleInvite(data: { name: string; email: string; roleKey: string }) {
    const role = roles.find((r) => r.key === data.roleKey)
    const newMember: RichMember = {
      id: `u_${Date.now()}`,
      name: data.name || data.email,
      initials: (data.name || data.email)
        .split(/[\s@]/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0].toUpperCase())
        .join(""),
      role: role?.name ?? data.roleKey,
      email: data.email,
      status: "invited",
      roleKey: data.roleKey,
      lastActive: null,
    }
    setMembers((prev) => [...prev, newMember])
    setInviteOpen(false)
    setInviteKey((k) => k + 1)
    toast.success(`Invitation sent to ${data.email}`)
  }

  // ---------- Table columns ----------
  const columns: SortableColumn<RichMember>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      sortValue: (r) => r.name,
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            <AvatarFallback
              className={cn(
                "text-xs font-semibold",
                row.status === "disabled" ? "opacity-40" : "",
              )}
            >
              {row.initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p
              className={cn(
                "text-sm font-medium leading-tight",
                row.status === "disabled" ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {row.name}
            </p>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              {row.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      sortValue: (r) => r.role,
      render: (row) => (
        <span className="text-sm text-foreground">{row.role}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (r) => r.status,
      render: (row) => <MemberStatusBadge status={row.status} />,
    },
    {
      key: "lastActive",
      header: "Last active",
      sortable: true,
      sortValue: (r) => r.lastActive ?? "",
      render: (row) => (
        <span
          className={cn(
            "text-sm tabular-nums",
            row.lastActive ? "text-muted-foreground" : "text-muted-foreground/50",
          )}
        >
          {row.lastActive ?? "Never"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <MemberActions
            member={row}
            onResend={handleResend}
            onDisable={handleDisable}
            onEnable={handleEnable}
          />
        </div>
      ),
    },
  ]

  // ---------- Status filter pills ----------
  const STATUS_FILTER_OPTIONS: { value: "all" | MemberStatus; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "invited", label: "Invited" },
    { value: "disabled", label: "Disabled" },
  ]

  return (
    <div className="flex flex-col gap-10">
      {/* ── Team members section ── */}
      <section aria-labelledby="team-heading">
        <div className="mb-5 flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            People
          </p>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2
                id="team-heading"
                className="text-xl font-semibold tracking-[-0.022em] text-foreground"
              >
                Team &amp; roles
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Invite your team, assign roles, and manage access.
              </p>
            </div>

            <EntitySheet
              trigger={
                <Button variant="default" size="default" aria-label="Invite a new team member">
                  <UserPlus className="size-4" aria-hidden />
                  Invite member
                </Button>
              }
              title="Invite team member"
              description="They'll receive an email to set up their account."
              saveLabel="Send invite"
              onSave={() => {
                // no-op: handled via InviteForm submit
                toast("Invitation sent (prototype)")
              }}
            >
              <InviteForm
                key={inviteKey}
                roles={roles}
                onSubmit={handleInvite}
              />
            </EntitySheet>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <DataToolbar
            search={{
              value: search,
              onChange: setSearch,
              placeholder: "Search by name or email…",
            }}
            resultCount={filtered.length}
            totalCount={members.length}
          >
            {/* Status filter chips */}
            <div className="flex items-center gap-1" role="group" aria-label="Filter by status">
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={statusFilter === opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={cn(
                    "inline-flex h-7 items-center rounded-full px-3 text-xs font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    statusFilter === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </DataToolbar>

          <SortableTable<RichMember>
            columns={columns}
            rows={filtered}
            getRowId={(r) => r.id}
            initialSort={{ key: "name", dir: "asc" }}
            stickyHeader
            emptyState={
              <div className="flex flex-col items-center gap-2 py-4">
                <p className="text-sm font-medium text-foreground">No members found</p>
                <p className="text-xs text-muted-foreground">
                  {search
                    ? "Try a different name or email."
                    : "Invite your first team member to get started."}
                </p>
              </div>
            }
          />
        </div>
      </section>

      <Separator />

      {/* ── Permission matrix section ── */}
      <section aria-labelledby="permissions-heading">
        <div className="mb-5 flex items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent">
            <ShieldCheck className="size-4 text-accent-foreground" aria-hidden />
          </div>
          <div>
            <h2
              id="permissions-heading"
              className="text-base font-semibold text-foreground"
            >
              Role permissions
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Permissions are fixed per role — contact{" "}
              <span className="font-medium text-foreground">VenueFlow support</span> if
              you need a custom arrangement.
            </p>
          </div>
        </div>

        <PermissionMatrix roles={roles} rolePermissions={rolePermissions} />

        <p className="mt-3 text-xs text-muted-foreground">
          Role descriptions:{" "}
          {roles.map((r, i) => (
            <React.Fragment key={r.key}>
              {i > 0 && " · "}
              <span className="font-medium text-foreground">{r.name}</span>{" "}
              &mdash; {r.description.toLowerCase()}
            </React.Fragment>
          ))}
          .
        </p>
      </section>
    </div>
  )
}
