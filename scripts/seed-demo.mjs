/**
 * seed-demo.mjs
 * VenueFlow — seed a demo venue with a known login + realistic sample data.
 * Run: node scripts/seed-demo.mjs
 *
 * Idempotent: deletes the existing demo user (cascades venue → contacts →
 * opportunities → stage_events) and recreates everything fresh.
 *
 * Login after running:  demo@venueflow.io  /  WeddingDemo123!
 */

import { readFileSync } from "node:fs";
import { createClient } from "../node_modules/@supabase/supabase-js/dist/index.mjs";

function loadEnv(filePath) {
  const env = {};
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[t.slice(0, i).trim()] = v;
  }
  return env;
}

const env = loadEnv(new URL("../.env.local", import.meta.url).pathname);
const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const DEMO_EMAIL = "demo@venueflow.io";
const DEMO_PASSWORD = "WeddingDemo123!";
const DEMO_SLUG = "the-old-barn-demo";

// 14 sample couples spread across the 8 stages.
const SAMPLE = [
  { first: "Olivia", last: "Bennett", pf: "James", pl: "Carter", stage: "inbound_enquiry", date: "2027-08-14", guests: 120, budget: 22000, source: "Website" },
  { first: "Sophie", last: "Turner", pf: "Liam", pl: "Walsh", stage: "inbound_enquiry", date: "2027-06-19", guests: 90, budget: 16000, source: "Hitched" },
  { first: "Amelia", last: "Hughes", pf: "Noah", pl: "Reed", stage: "inbound_enquiry", date: null, guests: null, budget: null, source: "Instagram" },
  { first: "Grace", last: "Mitchell", pf: "Ethan", pl: "Price", stage: "responded", date: "2027-09-04", guests: 140, budget: 28000, source: "Website" },
  { first: "Isla", last: "Cooper", pf: "Jack", pl: "Murphy", stage: "responded", date: "2027-05-22", guests: 80, budget: 14000, source: "Referral" },
  { first: "Freya", last: "Ward", pf: "Oscar", pl: "Hughes", stage: "viewing_interest", date: "2027-07-31", guests: 110, budget: 20000, source: "Hitched" },
  { first: "Charlotte", last: "Evans", pf: "Henry", pl: "Shaw", stage: "viewing_interest", date: "2027-10-09", guests: 160, budget: 34000, source: "Website" },
  { first: "Ella", last: "Foster", pf: "George", pl: "Webb", stage: "appointment_booked", date: "2027-06-12", guests: 100, budget: 18500, source: "Instagram" },
  { first: "Lily", last: "Barnes", pf: "Charlie", pl: "Dean", stage: "appointment_booked", date: "2028-04-15", guests: 130, budget: 25000, source: "Referral" },
  { first: "Maya", last: "Richardson", pf: "Alfie", pl: "Knight", stage: "appointment_attended", date: "2027-09-18", guests: 115, budget: 21000, source: "Website" },
  { first: "Ava", last: "Coleman", pf: "Leo", pl: "Marsh", stage: "date_on_hold", date: "2027-08-28", guests: 95, budget: 17500, source: "Hitched" },
  { first: "Poppy", last: "Stewart", pf: "Max", pl: "Holt", stage: "wedding_booked", date: "2027-07-10", guests: 150, budget: 31000, source: "Website" },
  { first: "Daisy", last: "Palmer", pf: "Theo", pl: "Lane", stage: "wedding_booked", date: "2027-09-25", guests: 125, budget: 27000, source: "Referral" },
  { first: "Rosie", last: "Hart", pf: "Sam", pl: "Ford", stage: "archived", date: null, guests: 60, budget: null, source: "Instagram" },
];

async function findUserByEmail(email) {
  // Page through admin users (small project — one page is enough).
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data?.users?.find((u) => u.email === email) ?? null;
}

async function run() {
  console.log("=== VenueFlow demo seed ===\n");

  // 1. Clean slate: delete existing demo user (cascades venue + all data).
  const existing = await findUserByEmail(DEMO_EMAIL);
  if (existing) {
    const { data: ms } = await admin.from("memberships").select("venue_id").eq("user_id", existing.id);
    for (const m of ms ?? []) {
      await admin.from("venues").delete().eq("id", m.venue_id); // cascades contacts/opps/events
    }
    await admin.auth.admin.deleteUser(existing.id);
    console.log("  cleaned previous demo user");
  }

  // 2. Create the demo user (email pre-confirmed).
  const { data: created, error: uErr } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (uErr || !created.user) throw new Error(`createUser: ${uErr?.message}`);
  const userId = created.user.id;
  console.log(`  user:  ${DEMO_EMAIL}`);

  // 3. Create a fully-onboarded venue + owner membership.
  const { data: venue, error: vErr } = await admin
    .from("venues")
    .insert({
      name: "The Old Barn",
      slug: DEMO_SLUG,
      timezone: "Europe/London",
      onboarding_step: 3,
      onboarding_completed_at: new Date().toISOString(),
      trial_ends_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    })
    .select("id")
    .single();
  if (vErr || !venue) throw new Error(`venue: ${vErr?.message}`);
  await admin.from("memberships").insert({ venue_id: venue.id, user_id: userId, role: "owner" });
  console.log(`  venue: The Old Barn (${DEMO_SLUG})`);

  // A couple of spaces so settings isn't bare.
  await admin.from("spaces").insert([
    { venue_id: venue.id, name: "The Barn", capacity_seated: 160, capacity_standing: 220 },
    { venue_id: venue.id, name: "Garden Pavilion", capacity_seated: 90, capacity_standing: 140 },
  ]);

  // 4. Contacts + one opportunity each, spread across stages.
  const perStageIndex = {};
  let count = 0;
  for (const s of SAMPLE) {
    const { data: contact, error: cErr } = await admin
      .from("contacts")
      .insert({
        venue_id: venue.id,
        first_name: s.first,
        last_name: s.last,
        email: `${s.first.toLowerCase()}.${s.last.toLowerCase()}@example.com`,
        phone: "+44 7700 900" + String(100 + count).slice(-3),
        partner_first_name: s.pf,
        partner_last_name: s.pl,
        wedding_date: s.date,
        guest_count: s.guests,
        budget_minor: s.budget != null ? s.budget * 100 : null,
        source: s.source,
      })
      .select("id")
      .single();
    if (cErr || !contact) throw new Error(`contact ${s.first}: ${cErr?.message}`);

    const idx = (perStageIndex[s.stage] = (perStageIndex[s.stage] ?? 0) + 1);
    const { error: oErr } = await admin.from("opportunities").insert({
      venue_id: venue.id,
      contact_id: contact.id,
      stage: s.stage,
      sort_index: idx * 1000,
    });
    if (oErr) throw new Error(`opportunity ${s.first}: ${oErr.message}`);
    count++;
  }
  console.log(`  ${count} contacts + opportunities across 8 stages`);

  // 5. Brochure (minimal PDF) + email settings, so the public form is end-to-end.
  const pdf = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
  );
  await admin.storage
    .from("brochures")
    .upload(`${venue.id}/brochure.pdf`, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });
  await admin.from("brochures").insert({
    venue_id: venue.id,
    file_path: `${venue.id}/brochure.pdf`,
    title: "The Old Barn — 2027 Wedding Brochure",
    is_active: true,
  });
  await admin.from("venue_email_settings").insert({
    venue_id: venue.id,
    from_name: "The Old Barn",
    reply_to: "weddings@theoldbarn.example.com",
  });
  console.log("  brochure + email settings");

  console.log("\n  Public form:  /f/the-old-barn-demo");
  console.log("\n=== Done. Log in at /login ===");
  console.log(`  email:    ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}\n`);
}

run().catch((e) => {
  console.error("\nSEED FAILED:", e.message);
  process.exit(1);
});
