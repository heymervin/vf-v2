"use server";

import { createElement } from "react";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import {
  inviteMemberSchema,
  changeRoleSchema,
  type TeamRole,
} from "@/lib/zod-schemas/settings-team";
import { sendEmail } from "@/lib/email/send";

// The `invitations` table is NOT in the generated types yet (added by
// 20260614130000_invitations.sql; types.ts regenerates on `supabase db push`).
// Same idiom as settings/actions.ts + pipeline/actions.ts: cast the client past
// the missing-table typing. Local shapes describe the rows we read/write.
/* eslint-disable @typescript-eslint/no-explicit-any */
type InvitationRow = {
  id: string;
  email: string;
  role: TeamRole;
  token: string;
  created_at: string;
  accepted_at: string | null;
};

export interface TeamMember {
  membershipId: string;
  userId: string;
  email: string;
  role: TeamRole;
  isSelf: boolean;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: TeamRole;
  link: string;
  createdAt: string;
}

function inviteLink(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return `${base}/accept-invite/${token}`;
}

/**
 * Load members (joined to auth emails) and pending invites for the active
 * venue. Any member can view; writes are owner-only (below).
 *
 * Emails live in auth.users, which RLS does not expose, so we resolve them with
 * the service-role admin client — strictly scoped to the membership user_ids of
 * the caller's own venue (the RLS-scoped client already enforced membership when
 * it returned those rows).
 */
export async function loadTeam(): Promise<
  ActionResult<{ members: TeamMember[]; invites: PendingInvite[]; canManage: boolean }>
> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");

  const supabase = await createClient();

  const { data: memberships, error: mErr } = await supabase
    .from("memberships")
    .select("id, user_id, role")
    .eq("venue_id", ctx.venue.id)
    .order("created_at", { ascending: true });
  if (mErr) {
    console.error("[loadTeam] memberships error:", mErr.message);
    return err("Could not load the team, please try again.");
  }

  const emailById = await resolveEmails(
    (memberships ?? []).map((m) => m.user_id),
  );

  const members: TeamMember[] = (memberships ?? []).map((m) => ({
    membershipId: m.id,
    userId: m.user_id,
    email: emailById.get(m.user_id) ?? "(unknown email)",
    role: m.role as TeamRole,
    isSelf: m.user_id === ctx.user.id,
  }));

  const { data: inviteRows, error: iErr } = await (supabase as any)
    .from("invitations")
    .select("id, email, role, token, created_at, accepted_at")
    .eq("venue_id", ctx.venue.id)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  if (iErr) {
    console.error("[loadTeam] invitations error:", iErr.message);
    return err("Could not load invites, please try again.");
  }

  const invites: PendingInvite[] = ((inviteRows ?? []) as InvitationRow[]).map(
    (r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      link: inviteLink(r.token),
      createdAt: r.created_at,
    }),
  );

  return ok({ members, invites, canManage: ctx.role === "owner" });
}

/**
 * Invite a teammate. Owner only. Creates an invitation row, replacing any
 * existing OPEN invite for the same email (re-invite). Returns the invite link
 * to show in the UI; the Resend email is best-effort.
 */
export async function inviteMember(
  input: unknown,
): Promise<ActionResult<{ link: string; emailSent: boolean }>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  if (ctx.role !== "owner") {
    return err("Only the owner can invite team members.");
  }

  const parsed = inviteMemberSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Check the invite details.");
  }
  const { email, role } = parsed.data;

  const supabase = await createClient();

  // Don't invite someone who is already on the team.
  const { data: existingMembers } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("venue_id", ctx.venue.id);
  const memberEmails = await resolveEmails(
    (existingMembers ?? []).map((m) => m.user_id),
  );
  for (const e of memberEmails.values()) {
    if (e.toLowerCase() === email) {
      return err("That person is already on your team.");
    }
  }

  // Replace any existing OPEN invite for this email — the partial unique index
  // uq_invitations_open_venue_email would otherwise reject a duplicate.
  await (supabase as any)
    .from("invitations")
    .delete()
    .eq("venue_id", ctx.venue.id)
    .eq("email", email)
    .is("accepted_at", null);

  const { data: inserted, error: insErr } = await (supabase as any)
    .from("invitations")
    .insert({
      venue_id: ctx.venue.id,
      email,
      role,
      invited_by: ctx.user.id,
    })
    .select("token")
    .single();

  if (insErr || !inserted) {
    console.error("[inviteMember] insert error:", insErr?.message);
    return err("Could not create the invite, please try again.");
  }

  const link = inviteLink((inserted as { token: string }).token);

  // Best-effort email — never block the invite on a send failure.
  const sendResult = await sendEmail({
    to: email,
    subject: `You've been invited to join ${ctx.venue.name} on VenueFlow`,
    fromName: ctx.venue.name,
    react: inviteEmailBody(ctx.venue.name, role, link),
  });

  revalidatePath("/settings/team");
  return ok({ link, emailSent: sendResult.ok });
}

/**
 * Change a member's role. Owner only. The venue must never lose its last owner:
 * demoting the only owner is blocked.
 */
export async function changeMemberRole(
  input: unknown,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  if (ctx.role !== "owner") {
    return err("Only the owner can change roles.");
  }

  const parsed = changeRoleSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid request.");
  }
  const { membershipId, role } = parsed.data;

  const supabase = await createClient();

  const { data: target, error: tErr } = await supabase
    .from("memberships")
    .select("id, role")
    .eq("id", membershipId)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();
  if (tErr || !target) return err("That member could not be found.");

  // Guard the last owner: only block when demoting AND no other owner remains.
  if (target.role === "owner" && role !== "owner") {
    if ((await ownerCount(supabase, ctx.venue.id)) <= 1) {
      return err("You can't demote the last owner. Promote someone first.");
    }
  }

  const { error: updErr } = await supabase
    .from("memberships")
    .update({ role })
    .eq("id", membershipId)
    .eq("venue_id", ctx.venue.id);
  if (updErr) {
    console.error("[changeMemberRole] update error:", updErr.message);
    return err("Could not change the role, please try again.");
  }

  revalidatePath("/settings/team");
  return ok(undefined);
}

/**
 * Remove a member. Owner only. The last owner cannot be removed.
 */
export async function removeMember(
  membershipId: string,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  if (ctx.role !== "owner") {
    return err("Only the owner can remove team members.");
  }

  const supabase = await createClient();

  const { data: target, error: tErr } = await supabase
    .from("memberships")
    .select("id, role")
    .eq("id", membershipId)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();
  if (tErr || !target) return err("That member could not be found.");

  if (target.role === "owner") {
    if ((await ownerCount(supabase, ctx.venue.id)) <= 1) {
      return err("You can't remove the last owner. Promote someone first.");
    }
  }

  const { error: delErr } = await supabase
    .from("memberships")
    .delete()
    .eq("id", membershipId)
    .eq("venue_id", ctx.venue.id);
  if (delErr) {
    console.error("[removeMember] delete error:", delErr.message);
    return err("Could not remove the member, please try again.");
  }

  revalidatePath("/settings/team");
  return ok(undefined);
}

/**
 * Revoke a pending invite. Owner only.
 */
export async function revokeInvite(
  inviteId: string,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  if (ctx.role !== "owner") {
    return err("Only the owner can revoke invites.");
  }

  const supabase = await createClient();
  const { error: delErr } = await (supabase as any)
    .from("invitations")
    .delete()
    .eq("id", inviteId)
    .eq("venue_id", ctx.venue.id);
  if (delErr) {
    console.error("[revokeInvite] delete error:", delErr.message);
    return err("Could not revoke the invite, please try again.");
  }

  revalidatePath("/settings/team");
  return ok(undefined);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Resolve auth emails for a set of user_ids via the service-role admin client.
// Returns a Map keyed by user_id. Used only after the RLS-scoped client has
// confirmed these users belong to the caller's venue.
async function resolveEmails(
  userIds: string[],
): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const byId = new Map<string, string>();
  for (const id of new Set(userIds)) {
    const { data } = await admin.auth.admin.getUserById(id);
    if (data.user?.email) byId.set(id, data.user.email);
  }
  return byId;
}

// Count owners on a venue. RLS lets members read their venue's memberships.
async function ownerCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
): Promise<number> {
  const { count } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId)
    .eq("role", "owner");
  return count ?? 0;
}

// Minimal invite email, built inline so we don't add a template file outside the
// feature's file set. sendEmail() requires a ReactElement; createElement keeps
// this a plain .ts module (no JSX/.tsx needed).
function inviteEmailBody(venueName: string, role: TeamRole, inviteUrl: string) {
  return createElement(
    "div",
    {
      style: {
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#101833",
        lineHeight: 1.5,
      },
    },
    createElement(
      "p",
      null,
      `You've been invited to join ${venueName} on VenueFlow as ${role}.`,
    ),
    createElement(
      "p",
      null,
      createElement("a", { href: inviteUrl }, "Accept your invitation"),
    ),
    createElement(
      "p",
      { style: { color: "#5B6175", fontSize: "13px" } },
      "If you didn't expect this invite, you can ignore this email.",
    ),
  );
}
