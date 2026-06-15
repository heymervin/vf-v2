/**
 * Floor / table template configurator — Admin › Spaces › [id] › Floor
 *
 * Route: /preview/admin/spaces/[id]/floor
 *
 * What it does:
 *   - Shows the room canvas for a specific space (falls back to sp1 if id unknown)
 *   - Renders placed tables using FloorCanvas + ShapedTable
 *   - Lists opinionated presets from FLOOR_TEMPLATES for this space
 *   - Sidebar panel: placed-table list with edit/remove; add-table EntitySheet
 *   - Click to select a table; selected table shows edit options
 *
 * Server component (reads params, passes to client child).
 * Next 16: params is a Promise.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SPACES, FLOOR_TEMPLATES } from "@/lib/mock/admin";
import { FLOORPLAN_TABLES, ROOM_ELEMENTS } from "@/lib/mock/planning";
import { FloorConfigClient } from "./floor-config-client";

export const metadata: Metadata = { title: "Floor template" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function FloorTemplatePage({ params }: PageProps) {
  const { id } = await params;

  // Resolve space — fall back to sp1 if id is unknown
  const space =
    SPACES.find((s) => s.id === id) ?? SPACES.find((s) => s.id === "sp1") ?? SPACES[0];

  // Templates for this space
  const templates = FLOOR_TEMPLATES.filter((t) => t.spaceId === space.id);

  // Seed the canvas with FLOORPLAN_TABLES if this is the primary space (sp1/Long Barn).
  // For other spaces, start with an empty canvas (no pre-seeded data in mock).
  const seedTables = space.id === "sp1" ? FLOORPLAN_TABLES : [];
  const roomElements = space.id === "sp1" ? ROOM_ELEMENTS : [];

  return (
    <div>
      {/* ── Breadcrumb back-link ── */}
      <div className="mb-5">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground -ml-2" asChild>
          <Link href="/preview/admin/spaces">
            <ChevronLeft className="size-3.5" />
            Spaces
          </Link>
        </Button>
      </div>

      {/* ── Eyebrow + title ── */}
      <div className="mb-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Floor template
        </p>
      </div>
      <h2 className="text-xl font-semibold tracking-tight text-foreground mb-1">
        {space.name}
      </h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
        Set up a table layout template for this space. Pick an opinionated preset or adjust individual tables — the venue saves one template per layout style (e.g. Banquet rows, Rounds). Couples never configure this; it&apos;s the default the team starts from.
      </p>

      <FloorConfigClient
        space={space}
        templates={templates}
        seedTables={seedTables}
        roomElements={roomElements}
      />
    </div>
  );
}
