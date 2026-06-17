"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { assertCanMutate } from "@/lib/billing/access";

// ── Public types ──────────────────────────────────────────────────────────────

export type MemberRole = "owner" | "admin" | "member";
export type MemberStatus = "active" | "invited" | "disabled";

export interface TeamMemberData {
  membershipId: string;
  userId: string;
  role: MemberRole;
  email: string;
  displayName: string;
  status: MemberStatus;
  createdAt: string;
}

// ── Role guard ────────────────────────────────────────────────────────────────

function requireOwner(role: string): ActionResult<never> | null {
  if (role !== "owner") {
    return err("Only the venue owner can manage team roles and invitations.");
  }
  return null;
}

function requireOwnerOrAdmin(role: string): ActionResult<never> | null {
  if (role !== "owner" && role !== "admin") {
    return err("Only owners and admins can manage the team.");
  }
  return null;
}

// ── listTeamMembers ───────────────────────────────────────────────────────────

/**
 * Load all memberships for the current venue, enriched with email from auth.
 * Uses the admin client to access auth.admin — RLS cannot reach auth.users.
 */
export async function listTeamMembers(): Promise<
  ActionResult<TeamMemberData[]>
> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = requireOwnerOrAdmin(ctx.role);
  if (guard) return guard;

  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("memberships")
    .select("id, user_id, role, created_at")
    .eq("venue_id", ctx.venue.id)
    .order("created_at", { ascending: true });

  if (error || !rows) {
    console.error("listTeamMembers failed:", error?.message);
    return err("Could not load team members.");
  }

  const members: TeamMemberData[] = [];
  for (const row of rows) {
    let email = "";
    let displayName = row.role === "owner" ? "Owner" : row.role;
    try {
      const { data: u } = await admin.auth.admin.getUserById(row.user_id);
      if (u?.user?.email) {
        email = u.user.email;
        displayName = email.split("@")[0] ?? email;
      }
    } catch {
      // non-critical — display fallback
    }
    members.push({
      membershipId: row.id,
      userId: row.user_id,
      role: row.role as MemberRole,
      email,
      displayName,
      status: "active",
      createdAt: row.created_at,
    });
  }

  return ok(members);
}

// ── changeRole ────────────────────────────────────────────────────────────────

const ChangeRoleSchema = z.object({
  membershipId: z.string().uuid(),
  role: z.enum(["admin", "member"]),
});

/**
 * Change a team member's role. Owner only.
 * The owner role itself cannot be transferred here (separate flow).
 */
export async function changeRole(
  input: z.infer<typeof ChangeRoleSchema>,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  const ownerGuard = requireOwner(ctx.role);
  if (ownerGuard) return ownerGuard;

  const parsed = ChangeRoleSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const { membershipId, role } = parsed.data;

  // Guard: do not allow changing the owner's own membership
  const admin = createAdminClient();
  const { data: target, error: fetchErr } = await admin
    .from("memberships")
    .select("user_id, role")
    .eq("id", membershipId)
    .eq("venue_id", ctx.venue.id)
    .single();

  if (fetchErr || !target) {
    return err("Membership not found.");
  }
  if (target.role === "owner") {
    return err("The owner role cannot be changed here.");
  }

  const { error } = await admin
    .from("memberships")
    .update({ role })
    .eq("id", membershipId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("changeRole failed:", error.message);
    return err("Could not update role.");
  }

  revalidatePath("/settings/team");
  return ok(undefined);
}

// ── inviteMember ──────────────────────────────────────────────────────────────

const InviteMemberSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(["admin", "member"]),
});

/**
 * Invite a new team member via Supabase auth.admin.inviteUserByEmail.
 * If the user already exists in auth, they receive the invite and the
 * membership row is created immediately.
 * Owner only.
 */
export async function inviteMember(
  input: z.infer<typeof InviteMemberSchema>,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  const ownerGuard = requireOwner(ctx.role);
  if (ownerGuard) return ownerGuard;

  const parsed = InviteMemberSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const { email, role } = parsed.data;

  const admin = createAdminClient();

  // Check if a membership already exists for this email
  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const existingUser = existingUsers?.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );

  if (existingUser) {
    // Check if they already have a membership in this venue
    const { data: existingMembership } = await admin
      .from("memberships")
      .select("id")
      .eq("venue_id", ctx.venue.id)
      .eq("user_id", existingUser.id)
      .maybeSingle();

    if (existingMembership) {
      return err("This person is already a member of your team.");
    }

    // Create membership directly
    const { error: memberErr } = await admin.from("memberships").insert({
      venue_id: ctx.venue.id,
      user_id: existingUser.id,
      role,
    });

    if (memberErr) {
      console.error("inviteMember insert existing failed:", memberErr.message);
      return err("Could not add team member.");
    }
  } else {
    // Invite new user via Supabase auth
    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          venue_id: ctx.venue.id,
          invited_role: role,
        },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/invite/accept`,
      },
    );

    if (inviteErr) {
      console.error("inviteMember invite failed:", inviteErr.message);
      return err("Could not send invitation. Please try again.");
    }

    // We cannot create the membership yet — the user doesn't exist in auth.users
    // until they accept. The accept route at /api/invite/accept creates the membership.
  }

  revalidatePath("/settings/team");
  return ok(undefined);
}

// ── removeMember ──────────────────────────────────────────────────────────────

const RemoveMemberSchema = z.object({
  membershipId: z.string().uuid(),
});

/**
 * Remove a team member by deleting their membership row.
 * Owner only. Cannot remove the owner's own membership.
 */
export async function removeMember(
  input: z.infer<typeof RemoveMemberSchema>,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  const ownerGuard = requireOwner(ctx.role);
  if (ownerGuard) return ownerGuard;

  const parsed = RemoveMemberSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const { membershipId } = parsed.data;

  const admin = createAdminClient();

  // Guard: cannot remove owner
  const { data: target } = await admin
    .from("memberships")
    .select("role")
    .eq("id", membershipId)
    .eq("venue_id", ctx.venue.id)
    .single();

  if (target?.role === "owner") {
    return err("The owner cannot be removed from the team.");
  }

  const { error } = await admin
    .from("memberships")
    .delete()
    .eq("id", membershipId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("removeMember failed:", error.message);
    return err("Could not remove team member.");
  }

  revalidatePath("/settings/team");
  return ok(undefined);
}
