import { SPACES } from "@/lib/mock/admin";
import { SpacesClient } from "./spaces-client";

export const metadata = { title: "Spaces · Admin — VenueFlow" };

/**
 * Spaces manager — server shell.
 *
 * Renders plain content (no PageHeader, no SettingsShell — both are provided
 * by the admin layout above this route). Starts with eyebrow + H2 per the
 * admin content-page convention in PROTOTYPE-BRIEF.md.
 *
 * Passes seeded SPACES to the client component which owns search, add/edit
 * via EntitySheet, and archive with optimistic state + sonner toast.
 */
export default function AdminSpacesPage() {
  return <SpacesClient initialSpaces={SPACES} />;
}
