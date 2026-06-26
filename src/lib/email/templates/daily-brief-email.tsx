import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Hr,
  Preview,
} from "@react-email/components";
import type { PipelineAggregate } from "@/lib/ghl/reports";

// Brand colours — same palette as other VenueFlow email templates.
const NAVY = "#101833";
const BG = "#F4F4F7";
const CARD = "#FFFFFF";
const MUTED = "#5B6175";

export interface DailyBriefEmailProps {
  venueName: string;
  pipeline: PipelineAggregate | null;
  portalActivity: { last_login_at: string | null; wedding_id: string }[];
  upcomingEvents: {
    title: string;
    starts_at_time: string;
    wedding_date: string | null;
    wedding_id: string;
  }[];
  overduePayments: {
    label: string;
    amount_minor: number;
    due_date: string;
    wedding_id: string;
  }[];
}

/**
 * Daily morning brief emailed to venue owners at ~7am.
 * Sections: header, pipeline, portal activity, upcoming events, overdue payments, footer.
 *
 * Rendered server-side by the daily-brief cron — the PipelineAggregate import is
 * safe here because this module is never bundled for the browser.
 */
export function DailyBriefEmail({
  venueName,
  pipeline,
  portalActivity,
  upcomingEvents,
  overduePayments,
}: DailyBriefEmailProps) {
  const date = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Html>
      <Head />
      <Preview>
        Your {venueName} brief for {date}
      </Preview>
      <Body
        style={{
          backgroundColor: BG,
          fontFamily:
            "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          margin: 0,
          padding: "32px 0",
        }}
      >
        <Container
          style={{
            backgroundColor: CARD,
            borderRadius: "12px",
            maxWidth: "560px",
            margin: "0 auto",
            padding: "40px",
          }}
        >
          {/* ── Header ──────────────────────────────────────────────── */}
          <Section>
            <Text
              style={{
                color: MUTED,
                fontSize: "12px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                margin: "0 0 8px",
              }}
            >
              {venueName}
            </Text>
            <Heading
              style={{
                color: NAVY,
                fontSize: "24px",
                lineHeight: 1.25,
                fontWeight: 700,
                margin: "0 0 4px",
              }}
            >
              Good morning — here&apos;s your brief
            </Heading>
            <Text
              style={{
                color: MUTED,
                fontSize: "14px",
                margin: "0 0 24px",
              }}
            >
              {date}
            </Text>
          </Section>

          <Hr style={{ borderColor: "#E6E6EC", margin: "0 0 28px" }} />

          {/* ── Section 1: Pipeline at a glance ─────────────────────── */}
          <Section style={{ marginBottom: "28px" }}>
            <Text
              style={{
                color: NAVY,
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                margin: "0 0 12px",
              }}
            >
              Pipeline at a glance
            </Text>

            {pipeline === null ? (
              <Text
                style={{
                  color: MUTED,
                  fontSize: "14px",
                  lineHeight: 1.6,
                  margin: 0,
                  padding: "12px 16px",
                  backgroundColor: BG,
                  borderRadius: "8px",
                }}
              >
                Connect VenueFlow to see your live pipeline in this brief.
              </Text>
            ) : (
              <>
                {/* Pipeline table */}
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "14px",
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: "left",
                          color: MUTED,
                          fontWeight: 600,
                          padding: "4px 8px 8px 0",
                          borderBottom: "1px solid #E6E6EC",
                        }}
                      >
                        Stage
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          color: MUTED,
                          fontWeight: 600,
                          padding: "4px 0 8px 8px",
                          borderBottom: "1px solid #E6E6EC",
                        }}
                      >
                        Count
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          color: MUTED,
                          fontWeight: 600,
                          padding: "4px 0 8px 8px",
                          borderBottom: "1px solid #E6E6EC",
                        }}
                      >
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipeline.stages.map((stage) => (
                      <tr key={stage.pipelineStageId}>
                        <td
                          style={{
                            color: NAVY,
                            padding: "6px 8px 6px 0",
                            borderBottom: "1px solid #F0F0F4",
                          }}
                        >
                          {stage.stageName}
                        </td>
                        <td
                          style={{
                            color: NAVY,
                            textAlign: "right",
                            padding: "6px 0 6px 8px",
                            borderBottom: "1px solid #F0F0F4",
                          }}
                        >
                          {stage.count}
                        </td>
                        <td
                          style={{
                            color: NAVY,
                            textAlign: "right",
                            padding: "6px 0 6px 8px",
                            borderBottom: "1px solid #F0F0F4",
                          }}
                        >
                          £{(stage.valueMinor / 100).toLocaleString("en-GB", { minimumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr>
                      <td
                        style={{
                          color: NAVY,
                          fontWeight: 700,
                          padding: "10px 8px 4px 0",
                        }}
                      >
                        Total
                      </td>
                      <td
                        style={{
                          color: NAVY,
                          fontWeight: 700,
                          textAlign: "right",
                          padding: "10px 0 4px 8px",
                        }}
                      >
                        {pipeline.totalCount}
                      </td>
                      <td
                        style={{
                          color: NAVY,
                          fontWeight: 700,
                          textAlign: "right",
                          padding: "10px 0 4px 8px",
                        }}
                      >
                        £{(pipeline.totalValueMinor / 100).toLocaleString("en-GB", { minimumFractionDigits: 0 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}
          </Section>

          <Hr style={{ borderColor: "#E6E6EC", margin: "0 0 28px" }} />

          {/* ── Section 2: Portal activity ───────────────────────────── */}
          <Section style={{ marginBottom: "28px" }}>
            <Text
              style={{
                color: NAVY,
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                margin: "0 0 12px",
              }}
            >
              Portal activity (last 24 hours)
            </Text>
            {portalActivity.length === 0 ? (
              <Text
                style={{ color: MUTED, fontSize: "14px", lineHeight: 1.6, margin: 0 }}
              >
                No portal activity in the last 24 hours.
              </Text>
            ) : (
              <Text
                style={{
                  color: NAVY,
                  fontSize: "14px",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                <strong>{portalActivity.length}</strong>{" "}
                {portalActivity.length === 1 ? "couple" : "couples"} active in the last
                24 hours.
              </Text>
            )}
          </Section>

          <Hr style={{ borderColor: "#E6E6EC", margin: "0 0 28px" }} />

          {/* ── Section 3: Upcoming events (next 48h) ───────────────── */}
          <Section style={{ marginBottom: "28px" }}>
            <Text
              style={{
                color: NAVY,
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                margin: "0 0 12px",
              }}
            >
              Upcoming events (next 7 days)
            </Text>
            {upcomingEvents.length === 0 ? (
              <Text
                style={{ color: MUTED, fontSize: "14px", lineHeight: 1.6, margin: 0 }}
              >
                No run-sheet events in the next 7 days.
              </Text>
            ) : (
              upcomingEvents.map((ev, i) => (
                <Text
                  key={i}
                  style={{
                    color: NAVY,
                    fontSize: "14px",
                    lineHeight: 1.6,
                    margin: "0 0 6px",
                  }}
                >
                  <strong>{ev.title}</strong> —{" "}
                  {ev.wedding_date
                    ? new Date(ev.wedding_date).toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })
                    : "Date TBC"}{" "}
                  at {ev.starts_at_time}
                </Text>
              ))
            )}
          </Section>

          <Hr style={{ borderColor: "#E6E6EC", margin: "0 0 28px" }} />

          {/* ── Section 4: Overdue payments ──────────────────────────── */}
          <Section style={{ marginBottom: "28px" }}>
            <Text
              style={{
                color: NAVY,
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                margin: "0 0 12px",
              }}
            >
              Overdue payments
            </Text>
            {overduePayments.length === 0 ? (
              <Text
                style={{ color: MUTED, fontSize: "14px", lineHeight: 1.6, margin: 0 }}
              >
                No overdue payments. All clear.
              </Text>
            ) : (
              overduePayments.map((payment, i) => (
                <Text
                  key={i}
                  style={{
                    color: NAVY,
                    fontSize: "14px",
                    lineHeight: 1.6,
                    margin: "0 0 6px",
                  }}
                >
                  {payment.label} —{" "}
                  <strong>
                    £
                    {(payment.amount_minor / 100).toLocaleString("en-GB", {
                      minimumFractionDigits: 0,
                    })}
                  </strong>{" "}
                  due {payment.due_date}
                </Text>
              ))
            )}
          </Section>

          <Hr style={{ borderColor: "#E6E6EC", margin: "0 0 16px" }} />

          {/* ── Footer ──────────────────────────────────────────────── */}
          <Section>
            <Text
              style={{
                color: MUTED,
                fontSize: "12px",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Sent by VenueFlow &middot; manage preferences in your venue settings
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default DailyBriefEmail;
