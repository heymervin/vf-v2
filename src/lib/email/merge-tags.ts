/**
 * Merge-tag substitution for nurture sequence emails.
 *
 * Supported tags (double-curly syntax):
 *   {{first_name}}    — contact's first name
 *   {{venue_name}}    — venue display name
 *   {{partner_name}}  — contact's partner first name (falls back to "your partner")
 *
 * Unknown tags are left in place so they surface visibly in logs rather than
 * silently producing broken copy.
 */

export interface MergeContext {
  firstName: string;
  venueName: string;
  partnerName?: string | null;
}

const FALLBACKS: Record<string, string> = {
  partner_name: "your partner",
};

export function applyMergeTags(template: string, ctx: MergeContext): string {
  const map: Record<string, string> = {
    first_name: ctx.firstName,
    venue_name: ctx.venueName,
    partner_name: ctx.partnerName ?? FALLBACKS.partner_name,
  };

  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : match;
  });
}
