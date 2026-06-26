/**
 * add-twm-members.mjs
 * Upserts owner memberships for @theweddingmarketers.com users across all
 * real venues, and patches onboarding_completed_at if null.
 *
 * Uses native fetch — no npm packages required.
 * Run: node scripts/add-twm-members.mjs
 */

import { readFileSync } from "node:fs";

function loadEnv(filePath) {
  const env = {};
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[t.slice(0, i).trim()] = v;
  }
  return env;
}

const env = loadEnv(new URL("../../.env.local", import.meta.url).pathname);
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function sb(method, path, body) {
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const TWM_EMAILS = [
  "kai@theweddingmarketers.com",
  "trey@theweddingmarketers.com",
  "mervin@theweddingmarketers.com",
];

// Fetch all auth users (paginated — 1000 max)
const { users } = await sb("GET", "/auth/v1/admin/users?per_page=1000&page=1");

const twmUsers = TWM_EMAILS.map((email) => {
  const u = users.find((u) => u.email === email);
  if (!u) console.warn(`  ⚠  no auth user for ${email}`);
  return u ? { email, id: u.id } : null;
}).filter(Boolean);

if (!twmUsers.length) {
  console.error("None of the TWM users exist in Supabase auth. Create their accounts first.");
  process.exit(1);
}

// Get all real venues via REST
const venues = await sb("GET", "/rest/v1/venues?select=id,name,slug,onboarding_completed_at&order=created_at.asc");
const realVenues = venues.filter(
  (v) => !v.slug.startsWith("contacts-venue-form-") && !v.slug.startsWith("onboard-smoke-"),
);

if (!realVenues.length) {
  console.error("No real venues found.");
  process.exit(1);
}

console.log(`${twmUsers.length} TWM user(s), ${realVenues.length} venue(s)\n`);

for (const venue of realVenues) {
  for (const user of twmUsers) {
    await sb("POST", "/rest/v1/memberships?on_conflict=venue_id,user_id", {
      venue_id: venue.id,
      user_id: user.id,
      role: "owner",
    });
    console.log(`  ✓ ${user.email} → "${venue.name}" (owner)`);
  }

  if (!venue.onboarding_completed_at) {
    await sb(
      "PATCH",
      `/rest/v1/venues?id=eq.${venue.id}`,
      { onboarding_completed_at: new Date().toISOString() },
    );
    console.log(`  ✓ patched onboarding for "${venue.name}"`);
  }
}

console.log("\nDone. Login with your @theweddingmarketers.com credentials.");
