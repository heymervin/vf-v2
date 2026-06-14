import { z } from "zod";

// Roles mirror the memberships.role CHECK constraint (owner/admin/member).
export const teamRoleSchema = z.enum(["owner", "admin", "member"], {
  error: "Pick a valid role.",
});

export type TeamRole = z.infer<typeof teamRoleSchema>;

// Invite a teammate by email + role. Email is lowercased/trimmed to match the
// citext column behaviour on the invitations table.
export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { error: "Enter an email address." })
    .email({ error: "Enter a valid email address." })
    .max(254, { error: "That email is too long." }),
  role: teamRoleSchema,
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

// Change an existing member's role.
export const changeRoleSchema = z.object({
  membershipId: z.string().uuid({ error: "Invalid member." }),
  role: teamRoleSchema,
});

export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
