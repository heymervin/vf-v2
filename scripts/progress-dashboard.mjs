/**
 * Generates reports/progress-dashboard.html from the SLICES data below.
 * Each loop iteration: flip a slice's `status`, then `node scripts/progress-dashboard.mjs`.
 *   status: "done" | "build" | "block"
 */
import { writeFileSync } from "node:fs";

const SLICES = [
  { id: "2",  title: "CSV contact import",            status: "done",  phase: "Now",   owner: "VF2",
    note: "parseCsv + importContacts (dedupe by email, RLS insert) + Import buttons. 7/7 csv tests." },
  { id: "3",  title: "Dashboard assembly",            status: "done",  phase: "Now",   owner: "VF2",
    note: "KPI strip + today's appts + top-3 Copilot + next payments. Extracted computeCopilotInsights → lib." },
  { id: "4",  title: "Chef / kitchen print view",     status: "done",  phase: "Now",   owner: "VF2",
    note: "Allergen rollup + dish counts + special-dietary list, print-friendly. Extracted menu compose → menu-data.ts." },
  { id: "5",  title: "BEO generator",                 status: "done",  phase: "Now",   owner: "VF2",
    note: "Printable Banquet Event Order: run-of-show + catering summary + suppliers + notes. Shared buildMenuSummary + MenuSummaryView with the chef sheet." },
  { id: "7",  title: "iCal export feed",              status: "done",  phase: "Now",   owner: "VF2",
    note: "Token-secured (stateless HMAC, no DB) .ics feed at /api/calendar/[venueId]; subscribe card on Appointments. 3/3 builder tests." },
  { id: "11", title: "Reporting depth",               status: "done",  phase: "Next",  owner: "VF2",
    note: "CSV export (shared lib/csv) + forward-booking pace forecast card. Date-range on pre-aggregated leads views needs a DB change — deferred." },
  { id: "12", title: "Lead scoring (0–100)",          status: "done",  phase: "Later", owner: "VF2",
    note: "Pure scorer (budget/date/guests/contactable/freshness) in lib/leads/score.ts + sortable colour-coded Score column on contacts. 5/5 tests." },
  { id: "14", title: "Cross-venue roll-up",           status: "done",  phase: "Later", owner: "VF2",
    note: "Portfolio table on Reports (shown for multi-venue owners): forward bookings per venue + totals, via the agency RLS union. No DB change." },
  { id: "16", title: "Mobile event-day mode",         status: "done",  phase: "Later", owner: "VF2",
    note: "Phone-first event-day cockpit at runsheet/day: NOW/NEXT + run-of-show + supplier check-in / tap-to-call. 'Day mode' link on the run-sheet." },
  { id: "1/8", title: "Proposals + contracts + e-sign → GHL", status: "block", phase: "Next", owner: "Hybrid",
    note: "Needs live GHL creds to verify + the white-label branding decision (couples see a leadconnector signing URL)." },
  { id: "6",  title: "2-way messaging → GHL",         status: "block", phase: "Now",   owner: "GHL",
    note: "Code is simple (ghlClient.sendMessage exists) but needs a live GHL sub-account to verify." },
  { id: "9",  title: "Provisional date holds",        status: "block", phase: "Next",  owner: "VF2",
    note: "Needs a DB migration — this worktree's DB (Project B) has no DB password to apply / regen types." },
  { id: "10", title: "Multi-stakeholder contacts",    status: "block", phase: "Next",  owner: "VF2",
    note: "New wedding_contacts join table — same DB-migration blocker as #9." },
  { id: "13", title: "Google 2-way calendar",         status: "block", phase: "Later", owner: "VF2",
    note: "Needs the Gmail/Google OAuth path (not built yet)." },
  { id: "15", title: "AI copilot drafted replies",    status: "block", phase: "Later", owner: "VF2",
    note: "Greenfield — needs an LLM provider decision; sends via GHL." },
];

const DELIVERABLES = [
  ["Contacts page + left-nav overhaul", "repointed list to the contacts table; sortable/searchable/filterable, Lead/Booked status, column toggle, CSV export; sidebar regrouped, dead bundled prop removed.", "Fixed the “contact opens a wedding” bug."],
  ["GHL → contacts sync (won/booked)", "upsert-contact.ts; links weddings.contact_id on login + live webhook.", "typecheck/lint/tests green."],
  ["Competitive gap analysis", "9 wedding-venue platforms, 125-capability coverage matrix.", "specs/COMPETITIVE-GAP-ANALYSIS.md + reports/competitive-gap-analysis.html"],
  ["Gap-implementation plan", "phased Now/Next/Later, approved.", "Now being executed (this board)."],
];

const counts = { done: 0, build: 0, block: 0 };
for (const s of SLICES) counts[s.status]++;
const total = SLICES.length;
const pct = (n) => ((n / total) * 100).toFixed(2);

const esc = (s) => String(s).replace(/&(?!amp;|lt;|gt;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const phaseTag = (p) => `<span class="tag ${p.toLowerCase()}">${p}</span>`;
const ownerTag = (o) => `<span class="tag ${o.toLowerCase()}">${o}</span>`;

function card(s) {
  return `<div class="card ${s.status}"><div class="t">#${s.id} · ${esc(s.title)}</div>
      <div class="m">${esc(s.note)}</div>
      <div class="tags">${phaseTag(s.phase)}${ownerTag(s.owner)}</div></div>`;
}
const col = (status) => SLICES.filter((s) => s.status === status).map(card).join("\n    ");

const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="30">
<title>VenueFlow v2 — Build Progress</title>
<style>
:root{--ink:#1a1a2e;--mut:#6b7280;--line:#e8e8ee;--bg:#f6f6f9;--card:#fff;--green:#16a34a;--blue:#2563eb;--gray:#9ca3af}
*{box-sizing:border-box}
body{margin:0;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--bg)}
.wrap{max-width:1240px;margin:0 auto;padding:34px 26px 70px}
h1{font-size:26px;letter-spacing:-.02em;margin:0 0 2px}
.sub{color:var(--mut);margin:0 0 22px;font-size:13px}
.bar{height:14px;border-radius:999px;background:#e6e6ee;overflow:hidden;display:flex;margin:0 0 6px}
.bar i{display:block;height:100%}
.bar .d{background:var(--green)}.bar .b{background:var(--blue)}.bar .x{background:var(--gray)}
.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--mut);margin:0 0 26px}
.dot{display:inline-block;width:9px;height:9px;border-radius:999px;margin-right:5px;vertical-align:middle}
.dot.d{background:var(--green)}.dot.b{background:var(--blue)}.dot.x{background:var(--gray)}
.cols{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
.col h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;margin:0 0 12px;display:flex;align-items:center;gap:7px}
.col .n{font-size:12px;color:var(--mut);font-weight:500}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px 15px;margin-bottom:11px;box-shadow:0 1px 2px rgba(20,20,40,.04)}
.card .t{font-weight:600;font-size:13.5px}
.card .m{font-size:12px;color:var(--mut);margin-top:4px;line-height:1.45}
.tags{margin-top:8px;display:flex;gap:6px;flex-wrap:wrap}
.tag{font-size:10.5px;font-weight:600;padding:1.5px 7px;border-radius:999px;text-transform:uppercase;letter-spacing:.03em}
.tag.now{background:#fce7f3;color:#9d174d}.tag.next{background:#dbeafe;color:#1e40af}.tag.later{background:#f3f4f6;color:#4b5563}
.tag.vf2{background:#dcfce7;color:#166534}.tag.ghl{background:#ede9fe;color:#5b21b6}.tag.hybrid{background:#fef3c7;color:#92400e}
.card.done{border-left:3px solid var(--green)}.card.build{border-left:3px solid var(--blue)}.card.block{border-left:3px solid var(--gray)}
.head.d{color:var(--green)}.head.b{color:var(--blue)}.head.x{color:var(--gray)}
.deliv{margin-top:34px}.deliv h2{font-size:15px;border-bottom:2px solid var(--ink);padding-bottom:7px}
.deliv ul{margin:12px 0 0;padding-left:0;list-style:none}
.deliv li{padding:8px 0;border-bottom:1px solid var(--line);font-size:13px;display:flex;gap:10px;align-items:baseline}
.deliv li .ok{color:var(--green);font-weight:700}.deliv li .meta{color:var(--mut);font-size:12px}
.foot{margin-top:30px;color:var(--gray);font-size:12px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
.pulse{display:inline-block;width:8px;height:8px;border-radius:999px;background:var(--green);margin-right:6px;animation:p 1.6s ease-in-out infinite}
@keyframes p{0%,100%{opacity:1}50%{opacity:.3}}
@media(max-width:820px){.cols{grid-template-columns:1fr}}
</style></head><body><div class="wrap">

<h1>VenueFlow v2 — Build Progress</h1>
<p class="sub">Gap-implementation loop · <span class="pulse"></span>building autonomously · auto-refreshes every 30s · ${stamp} UTC</p>

<div class="bar">
  <i class="d" style="width:${pct(counts.done)}%"></i>
  <i class="b" style="width:${pct(counts.build)}%"></i>
  <i class="x" style="width:${pct(counts.block)}%"></i>
</div>
<div class="legend">
  <span><span class="dot d"></span><b>${counts.done} done + verified</b></span>
  <span><span class="dot b"></span><b>${counts.build} buildable</b> (in the loop)</span>
  <span><span class="dot x"></span><b>${counts.block} blocked</b> (need you / external)</span>
  <span>· typecheck + lint + unit tests green per slice</span>
</div>

<div class="cols">
  <div class="col">
    <h2 class="head d">✅ Done + verified <span class="n">${counts.done}</span></h2>
    ${col("done")}
  </div>
  <div class="col">
    <h2 class="head b">🔨 Buildable — in the loop <span class="n">${counts.build}</span></h2>
    ${col("build")}
  </div>
  <div class="col">
    <h2 class="head x">⛔ Blocked — need you / external <span class="n">${counts.block}</span></h2>
    ${col("block")}
  </div>
</div>

<div class="deliv">
  <h2>Earlier this session (shipped + verified, uncommitted on <code>gap-analysis-vs-sonas</code>)</h2>
  <ul>
    ${DELIVERABLES.map(([t, d, m]) => `<li><span class="ok">✓</span><div><b>${esc(t)}</b> — ${esc(d)} <span class="meta">${esc(m)}</span></div></li>`).join("\n    ")}
  </ul>
</div>

<div class="foot">
  <span>Architecture: VF2 = upper layer on GHL · wedding data + contacts in VF2 Supabase · no Stripe/Resend</span>
  <span>Nothing committed yet — say the word to commit.</span>
</div>

</div></body></html>`;

writeFileSync(new URL("../reports/progress-dashboard.html", import.meta.url), html);
console.log(`progress-dashboard.html → ${counts.done} done · ${counts.build} buildable · ${counts.block} blocked`);
