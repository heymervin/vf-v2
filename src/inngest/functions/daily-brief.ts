import "server-only";
import { inngest } from "@/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPipelineAggregate } from "@/lib/ghl/reports";
import { sendEmail } from "@/lib/email/send";
import { DailyBriefEmail } from "@/lib/email/templates/daily-brief-email";

/**
 * daily-brief — Inngest scheduled function.
 *
 * Fires at 07:00 UTC daily and emails a morning digest to each venue owner.
 *
 * TODO (OQ-1): Single UTC cron means venues outside UTC/GMT get the brief at the
 * wrong local time in summer (BST = UTC+1 means 07:00 UTC = 06:00 BST — off by
 * an hour June–October). For the current single-venue TWM deployment the quick fix
 * is to run the cron at 0 6 * * * UTC. Fully correct per-timezone scheduling
 * requires per-venue child functions or a fan-out strategy — defer to post-GA.
 *
 * Each step.run is individually memoised by Inngest, making the function
 * safe to replay without re-sending emails or re-charging API rate limits for
 * steps that already completed.
 */
export const dailyBrief = inngest.createFunction(
  {
    id: "daily-brief",
    // UTC 7am daily.
    // NOTE: In BST (UTC+1, April–October) this fires at 06:00 local.
    // See TODO above. For TWM Europe/London, consider 0 6 * * * as a pragmatic
    // fix until per-venue timezone scheduling is implemented.
    triggers: { cron: "0 7 * * *" },
  },
  async ({ step }) => {
    // ──────────────────────────────────────────────────────────────────────────
    // Step 1: Load all venues
    // ──────────────────────────────────────────────────────────────────────────
    const venues = await step.run("load-venues", async () => {
      const admin = createAdminClient();
      const { data } = await admin
        .from("venues")
        .select("id, name, timezone");
      return data ?? [];
    });

    const results: Record<string, unknown>[] = [];

    // Run one venue at a time (sequential) to avoid hammering GHL rate limits.
    for (const venue of venues) {
      const result = await step.run(`brief-${venue.id}`, async () => {
        // ── a. GHL pipeline aggregate (gracefully degrades to null) ───────────
        // getPipelineAggregate returns null when the venue has no GHL credentials.
        // The brief is still assembled and sent; the email renders a "Connect GHL"
        // message in the pipeline section.
        let pipeline = null;
        try {
          pipeline = await getPipelineAggregate(venue.id);
        } catch (err) {
          // Non-fatal: a GHL error must not abort the entire venue brief.
          console.warn(
            `[daily-brief] getPipelineAggregate failed for venue ${venue.id}:`,
            err instanceof Error ? err.message : String(err),
          );
        }

        // ── b. Supabase reads (service-role, runs outside user session) ───────
        const admin = createAdminClient();
        const now = new Date();
        const since24h = new Date(now.getTime() - 86_400_000).toISOString();
        const todayStr = now.toISOString().split("T")[0];
        const in7DaysStr = new Date(now.getTime() + 7 * 86_400_000)
          .toISOString()
          .split("T")[0];

        const [activityRes, upcomingRes, overdueRes] = await Promise.all([
          // Portal activity: couples who logged in in the last 24h
          admin
            .from("couple_accounts")
            .select("last_login_at, wedding_id")
            .eq("venue_id", venue.id)
            .gte("last_login_at", since24h),

          // Upcoming run-sheet items: events on weddings happening in the next 7 days.
          // timeline_events has no datetime column — only starts_at_time (HH:MM).
          // Join weddings and filter on wedding_date (date-only) instead.
          admin
            .from("timeline_events")
            .select("title, starts_at_time, wedding_id, weddings!inner(wedding_date)")
            .eq("venue_id", venue.id)
            .gte("weddings.wedding_date", todayStr)
            .lte("weddings.wedding_date", in7DaysStr)
            .order("starts_at_time", { ascending: true })
            .limit(5),

          // Overdue payment milestones: the canonical stored 'overdue' status
          // (set by GHL balance-due sync / manually) OR a 'due' milestone whose
          // date has already passed.
          admin
            .from("payment_milestones")
            .select("label, amount_minor, due_date, wedding_id")
            .eq("venue_id", venue.id)
            .in("status", ["due", "overdue"])
            .lt("due_date", todayStr),
        ]);

        // ── c. Resolve venue owner email ──────────────────────────────────────
        // memberships stores user_id (not email). We resolve via auth.admin.getUserById
        // which requires the service-role key — safe here inside Inngest (server-only).
        const ownerRes = await admin
          .from("memberships")
          .select("user_id")
          .eq("venue_id", venue.id)
          .eq("role", "owner")
          .maybeSingle();

        if (!ownerRes.data?.user_id) {
          // No owner membership found — skip gracefully. Do not crash the step.
          console.warn(
            `[daily-brief] No owner membership for venue ${venue.id} — skipping brief.`,
          );
          return { skipped: true, reason: "no-owner-membership", venueId: venue.id };
        }

        const { data: authUser, error: authError } =
          await admin.auth.admin.getUserById(ownerRes.data.user_id);

        if (authError || !authUser?.user?.email) {
          console.warn(
            `[daily-brief] Could not resolve owner email for venue ${venue.id}:`,
            authError?.message ?? "no email on auth user",
          );
          return { skipped: true, reason: "owner-email-unresolvable", venueId: venue.id };
        }

        const ownerEmail = authUser.user.email;

        // ── d. Assemble email props ───────────────────────────────────────────
        const portalActivity = activityRes.data ?? [];
        const upcomingEvents = (upcomingRes.data ?? []).map((ev) => {
          const wedding = Array.isArray(ev.weddings)
            ? ev.weddings[0]
            : ev.weddings;
          return {
            title: ev.title,
            starts_at_time: ev.starts_at_time,
            wedding_date: wedding?.wedding_date ?? null,
            wedding_id: ev.wedding_id,
          };
        });
        const overduePayments = overdueRes.data ?? [];

        // ── e. Send the brief ─────────────────────────────────────────────────
        const sendResult = await sendEmail({
          to: ownerEmail,
          subject: `Daily brief — ${venue.name}`,
          react: DailyBriefEmail({
            venueName: venue.name,
            pipeline,
            portalActivity,
            upcomingEvents,
            overduePayments,
          }),
        });

        return {
          venueId: venue.id,
          ownerEmail,
          sendResult,
          stats: {
            pipelineConnected: pipeline !== null,
            portalActivityCount: portalActivity.length,
            upcomingEventsCount: upcomingEvents.length,
            overduePaymentsCount: overduePayments.length,
          },
        };
      });

      results.push(result as Record<string, unknown>);
    }

    return { venuesBriefed: venues.length, results };
  },
);
