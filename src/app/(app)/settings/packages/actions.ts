"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { ok, err, type ActionResult } from "@/lib/actions";
import { assertCanMutate } from "@/lib/billing/access";
import type { Tables } from "@/lib/supabase/types";
import { minorToMajor, majorStringToMinor } from "./money";

export type PackageRow = Tables<"packages">;
export type PackageLineRow = Tables<"package_lines">;
export type MenuItemRow = Tables<"menu_items">;

export interface PackageWithLines extends PackageRow {
  lines: PackageLineRow[];
}

// ---------------------------------------------------------------------------
// Load packages + lines
// ---------------------------------------------------------------------------

export async function getPackages(): Promise<
  ActionResult<{
    packages: PackageWithLines[];
    addOns: MenuItemRow[];
  }>
> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");

  const supabase = await createClient();

  const [pkgRes, linesRes, addOnsRes] = await Promise.all([
    supabase
      .from("packages")
      .select("*")
      .eq("venue_id", ctx.venue.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("package_lines")
      .select("*")
      .eq("venue_id", ctx.venue.id)
      .order("sort_order", { ascending: true }),
    // Add-ons: evening/drinks items from menu library
    supabase
      .from("menu_items")
      .select("*")
      .eq("venue_id", ctx.venue.id)
      .in("course", ["evening"])
      .order("sort_order", { ascending: true }),
  ]);

  if (pkgRes.error) {
    console.error("getPackages packages:", pkgRes.error.message);
    return err("Could not load packages.");
  }
  if (linesRes.error) {
    console.error("getPackages lines:", linesRes.error.message);
    return err("Could not load package lines.");
  }

  const linesById = new Map<string, PackageLineRow[]>();
  for (const line of linesRes.data ?? []) {
    const arr = linesById.get(line.package_id) ?? [];
    arr.push(line);
    linesById.set(line.package_id, arr);
  }

  const packages: PackageWithLines[] = (pkgRes.data ?? []).map((pkg) => ({
    ...pkg,
    lines: linesById.get(pkg.id) ?? [],
  }));

  return ok({ packages, addOns: addOnsRes.data ?? [] });
}

// ---------------------------------------------------------------------------
// Create package
// ---------------------------------------------------------------------------

const CreatePackageSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  season: z.enum(["Summer", "Autumn", "Winter", "Spring", "All year"]),
  description: z.string().max(500).default(""),
  fromPricePounds: z.string().default("0"),
});

export async function createPackage(
  input: z.infer<typeof CreatePackageSchema>,
): Promise<ActionResult<PackageRow>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can manage packages.");
  }

  const parsed = CreatePackageSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("packages")
    .insert({
      venue_id: ctx.venue.id,
      name: parsed.data.name,
      season: parsed.data.season,
      description: parsed.data.description,
      from_price_minor: majorStringToMinor(parsed.data.fromPricePounds),
      is_active: true,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("createPackage:", error?.message);
    return err("Could not create package.");
  }

  revalidatePath("/settings/packages");
  return ok(data);
}

// ---------------------------------------------------------------------------
// Update package
// ---------------------------------------------------------------------------

const UpdatePackageSchema = z.object({
  packageId: z.string().uuid(),
  name: z.string().min(1, "Name is required").max(120),
  season: z.enum(["Summer", "Autumn", "Winter", "Spring", "All year"]),
  description: z.string().max(500).default(""),
  fromPricePounds: z.string().default("0"),
});

export async function updatePackage(
  input: z.infer<typeof UpdatePackageSchema>,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can manage packages.");
  }

  const parsed = UpdatePackageSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("packages")
    .update({
      name: parsed.data.name,
      season: parsed.data.season,
      description: parsed.data.description,
      from_price_minor: majorStringToMinor(parsed.data.fromPricePounds),
    })
    .eq("id", parsed.data.packageId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("updatePackage:", error.message);
    return err("Could not update package.");
  }

  revalidatePath("/settings/packages");
  return ok(undefined);
}

// ---------------------------------------------------------------------------
// Toggle package is_active (archive / restore)
// ---------------------------------------------------------------------------

const TogglePackageSchema = z.object({
  packageId: z.string().uuid(),
  isActive: z.boolean(),
});

export async function togglePackageActive(
  input: z.infer<typeof TogglePackageSchema>,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can manage packages.");
  }

  const parsed = TogglePackageSchema.safeParse(input);
  if (!parsed.success) return err("Invalid input.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("packages")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.packageId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("togglePackageActive:", error.message);
    return err("Could not update package.");
  }

  revalidatePath("/settings/packages");
  return ok(undefined);
}

// ---------------------------------------------------------------------------
// Create package line
// ---------------------------------------------------------------------------

const CreateLineSchema = z.object({
  packageId: z.string().uuid(),
  label: z.string().min(1, "Label is required").max(200),
  unitPounds: z.string().default("0"),
  unitType: z.enum(["flat", "per_head", "per_evening"]),
  qtyTiedToGuests: z.boolean().default(false),
});

export async function createPackageLine(
  input: z.infer<typeof CreateLineSchema>,
): Promise<ActionResult<PackageLineRow>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can manage packages.");
  }

  const parsed = CreateLineSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  // Verify the package belongs to this venue
  const supabase = await createClient();
  const { data: pkg } = await supabase
    .from("packages")
    .select("id")
    .eq("id", parsed.data.packageId)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (!pkg) return err("Package not found.");

  const { data, error } = await supabase
    .from("package_lines")
    .insert({
      package_id: parsed.data.packageId,
      venue_id: ctx.venue.id,
      label: parsed.data.label,
      unit_minor: majorStringToMinor(parsed.data.unitPounds),
      unit_type: parsed.data.unitType,
      qty_tied_to_guests: parsed.data.qtyTiedToGuests,
      category: "package",
    })
    .select()
    .single();

  if (error || !data) {
    console.error("createPackageLine:", error?.message);
    return err("Could not create line item.");
  }

  revalidatePath("/settings/packages");
  return ok(data);
}

// ---------------------------------------------------------------------------
// Update package line
// ---------------------------------------------------------------------------

const UpdateLineSchema = z.object({
  lineId: z.string().uuid(),
  label: z.string().min(1, "Label is required").max(200),
  unitPounds: z.string().default("0"),
  unitType: z.enum(["flat", "per_head", "per_evening"]),
  qtyTiedToGuests: z.boolean().default(false),
});

export async function updatePackageLine(
  input: z.infer<typeof UpdateLineSchema>,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated.");
  const guard = assertCanMutate(ctx);
  if (guard) return guard;
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return err("Only owners and admins can manage packages.");
  }

  const parsed = UpdateLineSchema.safeParse(input);
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("package_lines")
    .update({
      label: parsed.data.label,
      unit_minor: majorStringToMinor(parsed.data.unitPounds),
      unit_type: parsed.data.unitType,
      qty_tied_to_guests: parsed.data.qtyTiedToGuests,
    })
    .eq("id", parsed.data.lineId)
    .eq("venue_id", ctx.venue.id);

  if (error) {
    console.error("updatePackageLine:", error.message);
    return err("Could not update line item.");
  }

  revalidatePath("/settings/packages");
  return ok(undefined);
}
