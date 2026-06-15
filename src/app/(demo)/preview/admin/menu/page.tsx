import { MENU_LIBRARY } from "@/lib/mock";
import { MenuLibraryClient } from "./menu-library-client";

export const metadata = { title: "Menu library · Admin — VenueFlow" };

/**
 * Admin menu library — server shell.
 *
 * Renders plain content (no PageHeader, no extra shell). The admin layout
 * already provides the SettingsShell with left-rail nav. Content starts with
 * an eyebrow + H2 header per the admin content-page convention.
 *
 * MENU_LIBRARY is the venue's master dish catalogue. Per-wedding menus pull
 * from this library at planning time. This page manages the catalogue itself:
 * add, edit, archive dishes; not a per-wedding menu assignment tool.
 */
export default function AdminMenuLibraryPage() {
  return <MenuLibraryClient initialItems={MENU_LIBRARY} />;
}
