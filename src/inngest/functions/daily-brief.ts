import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { ghlClient } from "@/lib/ghl/client";
import { sendEmail } from "@/lib/email/send";
import { DailyBriefEmail } from "@/lib/email/templates/daily-brief-email";
import type {
  PipelineStageCount,
  UpcomingTask,
  UpcomingPayment,
} from "@/lib/email/templates/daily-brief-email";

/**
 * Daily brief — scheduled at 7am UTC each day.
 *
 * For every venue that has email settings configured, we:
 *   1. Pull pipeline counts from GHL (if connected) — gracefully skipped when not.
 *   2. Count new contacts/enquiries in the last 7 days.
 *   3. Fetch wedding tasks due within the next 7 days.
 *   4. Count couple portal logins in the last 7 days.
 *   5. Fetch payment milestones due within the next 7 days.
 *
 * Each venue runs independently — a failure for one venue must not abort others.
 *
 * Spec: specs/ghl-integration.md § 9 (Integration Point 5 — Daily Brief)
 */
export const dailyBrief = inngest.createFunction(
  { id: "daily-brief", triggers: { cron: "0 7 * * *" } },
  async ({ step }) => {
    const admin = createAdminClient();

    // ------------------------------------------------------------------
    // 1. Load all venues
    // ------------------------------------------------------------------
    const venues = await step.run("load-venues", async () => {
      const { data } = await admin
        .from("venues")
        .select("id, name, timezone");
      return data ?? [];
    });

    if (venues.length === 0) {
      return { sentCount: 0, skippedCount: 0 };
    }

    let sentCount = 0;
    let skippedCount = 0;

    // ------------------------------------------------------------------
    // 2. Process each venue independently
    // ------------------------------------------------------------------
    for (const venue of venues) {
      const result = await step.run(`brief-venue-${venue.id}`, async () => {
        // Load email settings — skip venue if none configured
        const { data: emailSettings } = await admin
          .from("venue_email_settings")
          .select("from_name, reply_to")
          .eq("venue_id", venue.id)
          .maybeSingle();

        if (!emailSettings?.reply_to) {
          return { skipped: true, reason: "no-email-settings" };
        }

        // ── GHL pipeline counts (best-effort) ─────────────────────────
        let pipelineCounts: PipelineStageCount[] | null = null;
        try {
          const client = await ghlClient(venue.id);
          if (client) {
            pipelineCounts = await client.getPipelineCounts();
          }
        } catch (err) {
          // GHL failure is non-fatal — brief continues without pipeline data
          console.warn(
            `[daily-brief] GHL pipeline fetch failed for venue ${venue.id}:`,
            err instanceof Error ? err.message : err,
          );
        }

        // ── New contacts in the last 7 days ───────────────────────────
        const sevenDaysAgo = new Date(
          Date.now() - 7 * 24 * 60 * 60_000,
        ).toISOString();

        const { data: recentContacts } = await admin
          .from("contacts")
          .select("id")
          .eq("venue_id", venue.id)
          .gte("created_at", sevenDaysAgo);

        const newEnquiriesCount = recentContacts?.length ?? 0;

        // ── Wedding tasks due within the next 7 days ──────────────────
        const sevenDaysFromNow = new Date(
          Date.now() + 7 * 24 * 60 * 60_000,
        )
          .toISOString()
          .slice(0, 10); // date string YYYY-MM-DD

        const { data: taskRows } = await admin
          .from("wedding_tasks")
          .select("id, title, due_date")
          .eq("venue_id", venue.id)
          .eq("done", false)
          .lte("due_date", sevenDaysFromNow);

        const upcomingTasks: UpcomingTask[] = (taskRows ?? []).map((t) => ({
          id: t.id,
          title: t.title,
          due_date: t.due_date,
        }));

        // ── Couple portal logins in the last 7 days ───────────────────
        const { data: recentLogins } = await admin
          .from("couple_accounts")
          .select("id, last_login_at")
          .eq("venue_id", venue.id)
          .gte("last_login_at", sevenDaysAgo);

        const recentPortalLogins = recentLogins?.length ?? 0;

        // ── Payment milestones due within the next 7 days ─────────────
        const { data: milestoneRows } = await admin
          .from("payment_milestones")
          .select("id, label, due_date, amount_minor")
          .eq("venue_id", venue.id)
          .in("status", ["due", "overdue", "pending"])
          .lte("due_date", sevenDaysFromNow);

        const upcomingPayments: UpcomingPayment[] = (milestoneRows ?? []).map(
          (m) => ({
            id: m.id,
            label: m.label,
            due_date: m.due_date,
            amount_minor: m.amount_minor,
          }),
        );

        // ── Render + send the brief ───────────────────────────────────
        const date = new Date().toISOString().slice(0, 10);

        const sendResult = await sendEmail({
          to: emailSettings.reply_to,
          subject: `Daily brief — ${venue.name} · ${date}`,
          react: DailyBriefEmail({
            venueName: venue.name,
            date,
            pipelineCounts,
            newEnquiriesCount,
            upcomingTasks,
            recentPortalLogins,
            upcomingPayments,
          }),
          fromName: emailSettings.from_name ?? "VenueFlow",
          replyTo: null,
        });

        if (!sendResult.ok) {
          console.warn(
            `[daily-brief] sendEmail failed for venue ${venue.id}:`,
            sendResult.error,
          );
          return { skipped: false, sent: false, reason: sendResult.error };
        }

        return { skipped: false, sent: true };
      });

      if (result.skipped) {
        skippedCount += 1;
      } else {
        sentCount += 1;
      }
    }

    return { sentCount, skippedCount };
  },
);
