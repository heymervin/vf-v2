"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteMemberSchema } from "@/lib/zod-schemas/settings-team";
import type { TeamRole } from "@/lib/zod-schemas/settings-team";
import {
  changeMemberRole,
  inviteMember,
  removeMember,
  revokeInvite,
  type PendingInvite,
  type TeamMember,
} from "./actions";

const ROLES: { value: TeamRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
];

const roleLabel = (r: TeamRole) =>
  ROLES.find((x) => x.value === r)?.label ?? r;

export function TeamManager({
  members,
  invites,
  canManage,
}: {
  members: TeamMember[];
  invites: PendingInvite[];
  canManage: boolean;
}) {
  const router = useRouter();
  const ownerCount = members.filter((m) => m.role === "owner").length;
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = React.useState<TeamMember | null>(null);

  async function onRoleChange(member: TeamMember, role: TeamRole) {
    if (role === member.role) return;
    setPendingId(member.membershipId);
    const result = await changeMemberRole({
      membershipId: member.membershipId,
      role,
    });
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Role updated to ${roleLabel(role)}.`);
    router.refresh();
  }

  async function onConfirmRemove() {
    if (!removeTarget) return;
    setPendingId(removeTarget.membershipId);
    const result = await removeMember(removeTarget.membershipId);
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Member removed.");
    setRemoveTarget(null);
    router.refresh();
  }

  return (
    <>
      {/* Members */}
      <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Members
        </h2>
        <ul className="divide-y divide-border">
          {members.map((m) => {
            const isLastOwner = m.role === "owner" && ownerCount <= 1;
            const busy = pendingId === m.membershipId;
            return (
              <li
                key={m.membershipId}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {m.email}
                    {m.isSelf ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (you)
                      </span>
                    ) : null}
                  </p>
                </div>

                {canManage ? (
                  <Select
                    value={m.role}
                    onValueChange={(v) => onRoleChange(m, v as TeamRole)}
                    disabled={busy || isLastOwner}
                  >
                    <SelectTrigger
                      className="w-[130px]"
                      aria-label={`Role for ${m.email}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {roleLabel(m.role)}
                  </span>
                )}

                {canManage ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${m.email}`}
                    disabled={busy || isLastOwner}
                    onClick={() => setRemoveTarget(m)}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
        {canManage && ownerCount <= 1 ? (
          <p className="mt-4 text-xs text-muted-foreground">
            The last owner can&apos;t be removed or demoted. Promote someone to
            owner first.
          </p>
        ) : null}
      </div>

      {/* Invite + pending invites — owner only */}
      {canManage ? (
        <>
          <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Invite a teammate
            </h2>
            <InviteForm />
          </div>

          {invites.length > 0 ? (
            <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Pending invites
              </h2>
              <ul className="divide-y divide-border">
                {invites.map((inv) => (
                  <PendingInviteRow key={inv.id} invite={inv} />
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      {/* Remove confirm */}
      <Dialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removeTarget?.email}?</DialogTitle>
            <DialogDescription>
              They lose access to this venue immediately. You can re-invite them
              later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveTarget(null)}
              disabled={pendingId === removeTarget?.membershipId}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirmRemove}
              disabled={pendingId === removeTarget?.membershipId}
            >
              {pendingId === removeTarget?.membershipId
                ? "Removing…"
                : "Remove member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<TeamRole>("member");
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = inviteMemberSchema.safeParse({ email, role });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the invite.");
      return;
    }

    setSubmitting(true);
    const result = await inviteMember(parsed.data);
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    await copyLink(result.data.link);
    toast.success(
      result.data.emailSent
        ? "Invite sent — link copied too."
        : "Invite created — link copied to your clipboard.",
    );
    setEmail("");
    setRole("member");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="teammate@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="invite-role">Role</Label>
        <Select value={role} onValueChange={(v) => setRole(v as TeamRole)}>
          <SelectTrigger id="invite-role" className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" disabled={submitting}>
        <UserPlus /> {submitting ? "Inviting…" : "Send invite"}
      </Button>
    </form>
  );
}

function PendingInviteRow({ invite }: { invite: PendingInvite }) {
  const router = useRouter();
  const [revoking, setRevoking] = React.useState(false);

  async function onRevoke() {
    setRevoking(true);
    const result = await revokeInvite(invite.id);
    setRevoking(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Invite revoked.");
    router.refresh();
  }

  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{invite.email}</p>
        <p className="text-xs text-muted-foreground">
          Invited as {roleLabel(invite.role)} · awaiting acceptance
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await copyLink(invite.link);
          toast.success("Invite link copied.");
        }}
      >
        <Copy className="size-4" /> Copy link
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Revoke invite for ${invite.email}`}
        disabled={revoking}
        onClick={onRevoke}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="size-4" />
      </Button>
    </li>
  );
}

async function copyLink(link: string) {
  try {
    await navigator.clipboard.writeText(link);
  } catch {
    // Clipboard can fail (permissions/insecure context); the toast still shows
    // success for the create/revoke action — the link is visible in the list.
  }
}
