"use client";

import * as React from "react";
import {
  CheckCircle2,
  MoreHorizontal,
  UserPlus,
  XCircle,
  Check,
  Minus,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { SortableTable, type SortableColumn } from "@/components/sortable-table";
import { DataToolbar } from "@/components/data-toolbar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { changeRole, inviteMember, removeMember } from "./actions";
import type { TeamMemberData, MemberRole } from "./actions";

// ---------------------------------------------------------------------------
// Constants — role permission matrix
// ---------------------------------------------------------------------------

type Capability =
  | "manage_billing"
  | "manage_settings"
  | "manage_team"
  | "manage_pipeline"
  | "edit_weddings"
  | "view_reports"
  | "send_messages";

const CAPABILITY_META: Record<Capability, { label: string; description: string }> = {
  manage_billing: { label: "Manage billing", description: "Access subscription and payment settings" },
  manage_settings: { label: "Manage settings", description: "Edit venue profile, spaces, and messaging identity" },
  manage_team: { label: "Manage team", description: "Invite, edit, and disable team members" },
  manage_pipeline: { label: "Manage pipeline", description: "Move contacts through pipeline stages" },
  edit_weddings: { label: "Edit weddings", description: "Create and update wedding records and tasks" },
  view_reports: { label: "View reports", description: "Access revenue, pipeline, and source reports" },
  send_messages: { label: "Send messages", description: "Send emails, SMS, and WhatsApp messages" },
};

const CAPABILITY_ORDER: Capability[] = [
  "manage_billing",
  "manage_settings",
  "manage_team",
  "manage_pipeline",
  "edit_weddings",
  "view_reports",
  "send_messages",
];

const ROLE_PERMISSIONS: Record<MemberRole, Record<Capability, boolean>> = {
  owner: {
    manage_billing: true, manage_settings: true, manage_team: true,
    manage_pipeline: true, edit_weddings: true, view_reports: true, send_messages: true,
  },
  admin: {
    manage_billing: false, manage_settings: true, manage_team: true,
    manage_pipeline: true, edit_weddings: true, view_reports: true, send_messages: true,
  },
  member: {
    manage_billing: false, manage_settings: false, manage_team: false,
    manage_pipeline: false, edit_weddings: false, view_reports: false, send_messages: true,
  },
};

const ROLES: { key: MemberRole; name: string; description: string }[] = [
  { key: "owner", name: "Owner", description: "Full access including billing and account settings." },
  { key: "admin", name: "Admin", description: "Manage configuration, team and all weddings." },
  { key: "member", name: "Member", description: "View and reply; limited edit on assigned records." },
];

// ---------------------------------------------------------------------------
// Permission matrix
// ---------------------------------------------------------------------------

function PermissionMatrix() {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
      <table className="w-full caption-bottom text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground w-[220px] min-w-[180px]">
              Capability
            </th>
            {ROLES.map((role) => (
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
            const meta = CAPABILITY_META[cap];
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
                {ROLES.map((role) => {
                  const allowed = ROLE_PERMISSIONS[role.key][cap];
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
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invite sheet form
// ---------------------------------------------------------------------------

interface InviteFormState {
  email: string;
  role: "admin" | "member";
}

interface InviteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited: () => void;
}

function InviteSheet({ open, onOpenChange, onInvited }: InviteSheetProps) {
  const [form, setForm] = React.useState<InviteFormState>({ email: "", role: "member" });
  const [saving, setSaving] = React.useState(false);

  async function handleSend() {
    if (!form.email.trim()) {
      toast.error("Email address is required");
      return;
    }
    setSaving(true);
    const result = await inviteMember({ email: form.email.trim(), role: form.role });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Invitation sent to ${form.email}`);
    setForm({ email: "", role: "member" });
    onOpenChange(false);
    onInvited();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="text-base font-semibold text-foreground">
            Invite team member
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            They&apos;ll receive an email to set up their account.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="colleague@yourvenue.co.uk"
                autoComplete="email"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                They&apos;ll receive an invitation email to set up their account.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((prev) => ({ ...prev, role: v as "admin" | "member" }))}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div>
                      <p className="font-medium">Admin</p>
                      <p className="text-xs text-muted-foreground">
                        Manage configuration, team, and all weddings.
                      </p>
                    </div>
                  </SelectItem>
                  <SelectItem value="member">
                    <div>
                      <p className="font-medium">Member</p>
                      <p className="text-xs text-muted-foreground">
                        View and reply; limited edit on assigned records.
                      </p>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <SheetFooter className="border-t border-border px-6 py-4 flex-row items-center justify-end gap-2">
          <SheetClose asChild>
            <Button variant="ghost" size="default">
              Cancel
            </Button>
          </SheetClose>
          <Button
            variant="default"
            size="default"
            onClick={handleSend}
            disabled={saving}
          >
            <UserPlus className="size-4" aria-hidden />
            {saving ? "Sending…" : "Send invite"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Row actions menu
// ---------------------------------------------------------------------------

interface MemberActionsProps {
  member: TeamMemberData;
  isCurrentUser: boolean;
  onRoleChange: (membershipId: string, role: "admin" | "member") => void;
  onRemove: (membershipId: string) => void;
}

function MemberActions({ member, isCurrentUser, onRoleChange, onRemove }: MemberActionsProps) {
  const isOwner = member.role === "owner";
  const canModify = !isOwner && !isCurrentUser;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${member.email || member.displayName}`}
          className="size-8 data-[state=open]:bg-accent"
          disabled={!canModify}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {member.role !== "admin" && (
          <DropdownMenuItem onClick={() => onRoleChange(member.membershipId, "admin")}>
            Promote to Admin
          </DropdownMenuItem>
        )}
        {member.role !== "member" && (
          <DropdownMenuItem onClick={() => onRoleChange(member.membershipId, "member")}>
            Set as Member
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onRemove(member.membershipId)}
          className="text-destructive focus:text-destructive"
        >
          <XCircle className="size-4" aria-hidden />
          Remove from team
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Role badge
// ---------------------------------------------------------------------------

const ROLE_BADGE_VARIANT: Record<MemberRole, "default" | "secondary" | "teal"> = {
  owner: "default",
  admin: "teal",
  member: "secondary",
};

// ---------------------------------------------------------------------------
// TeamManager — main client component
// ---------------------------------------------------------------------------

interface TeamManagerProps {
  members: TeamMemberData[];
  currentUserId: string;
  isOwner: boolean;
}

export function TeamManager({ members: initialMembers, currentUserId, isOwner }: TeamManagerProps) {
  const router = useRouter();
  const [members, setMembers] = React.useState<TeamMemberData[]>(initialMembers);
  const [search, setSearch] = React.useState("");
  const [inviteOpen, setInviteOpen] = React.useState(false);

  function refresh() {
    router.refresh();
  }

  // ---------- Filtering ----------
  const filtered = React.useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        m.email.toLowerCase().includes(q) ||
        m.displayName.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q),
    );
  }, [members, search]);

  // ---------- Role change ----------
  async function handleRoleChange(membershipId: string, role: "admin" | "member") {
    const result = await changeRole({ membershipId, role });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setMembers((prev) =>
      prev.map((m) => (m.membershipId === membershipId ? { ...m, role } : m)),
    );
    toast.success("Role updated");
    refresh();
  }

  // ---------- Remove ----------
  async function handleRemove(membershipId: string) {
    const member = members.find((m) => m.membershipId === membershipId);
    const result = await removeMember({ membershipId });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setMembers((prev) => prev.filter((m) => m.membershipId !== membershipId));
    toast(`${member?.displayName ?? "Member"} removed from team`);
    refresh();
  }

  // ---------- Table columns ----------
  const columns: SortableColumn<TeamMemberData>[] = [
    {
      key: "displayName",
      header: "Member",
      sortable: true,
      sortValue: (r) => r.displayName,
      render: (row) => {
        const initials = row.displayName
          .split(/[\s@]/)
          .filter(Boolean)
          .slice(0, 2)
          .map((s) => s[0]?.toUpperCase() ?? "")
          .join("");
        return (
          <div className="flex items-center gap-3">
            <Avatar size="sm">
              <AvatarFallback className="text-xs font-semibold">
                {initials || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight text-foreground truncate max-w-[160px]">
                {row.displayName}
              </p>
              {row.email && row.email !== row.displayName && (
                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {row.email}
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      sortValue: (r) => r.role,
      render: (row) => (
        <Badge variant={ROLE_BADGE_VARIANT[row.role] ?? "secondary"}>
          {row.role === "owner" && <CheckCircle2 className="size-3" aria-hidden />}
          {row.role.charAt(0).toUpperCase() + row.role.slice(1)}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          {isOwner ? (
            <MemberActions
              member={row}
              isCurrentUser={row.userId === currentUserId}
              onRoleChange={handleRoleChange}
              onRemove={handleRemove}
            />
          ) : (
            <span className="size-8" />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-10">
      {/* Team members section */}
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

            {isOwner && (
              <Button
                variant="default"
                size="default"
                aria-label="Invite a new team member"
                onClick={() => setInviteOpen(true)}
              >
                <UserPlus className="size-4" aria-hidden />
                Invite member
              </Button>
            )}
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
          />

          <SortableTable<TeamMemberData>
            columns={columns}
            rows={filtered}
            getRowId={(r) => r.membershipId}
            initialSort={{ key: "role", dir: "asc" }}
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

      {/* Permission matrix section */}
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

        <PermissionMatrix />

        <p className="mt-3 text-xs text-muted-foreground">
          Role descriptions:{" "}
          {ROLES.map((r, i) => (
            <React.Fragment key={r.key}>
              {i > 0 && " · "}
              <span className="font-medium text-foreground">{r.name}</span>{" "}
              &mdash; {r.description.toLowerCase()}
            </React.Fragment>
          ))}
        </p>
      </section>

      {/* Invite sheet */}
      <InviteSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={refresh}
      />
    </div>
  );
}
