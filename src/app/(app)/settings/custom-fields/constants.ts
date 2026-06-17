export const FIELD_CAP = 12;

/**
 * Derive a DB key slug from a human label.
 * "How did you hear about us?" → "how_did_you_hear_about_us"
 */
export function deriveKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}
