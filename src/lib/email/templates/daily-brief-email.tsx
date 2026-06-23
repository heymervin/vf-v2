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

// Brand colours — same palette as other VenueFlow email templates.
const NAVY = "#101833";
const PINK = "#F6D1FF";
const BG = "#F4F4F7";
const CARD = "#FFFFFF";
const MUTED = "#5B6175";

export interface PipelineStageCount {
  pipelineStageId: string;
  count: number;
  totalValue: number;
}

export interface UpcomingTask {
  id: string;
  title: string;
  due_date: string | null;
}

export interface UpcomingPayment {
  id: string;
  label: string;
  due_date: string;
  amount_minor: number;
}

export interface DailyBriefEmailProps {
  venueName: string;
  /** ISO date string for the brief date (e.g. "2026-06-19") */
  date: string;
  /** Pipeline stage counts from GHL — absent when venue has no GHL connection. */
  pipelineCounts?: PipelineStageCount[] | null;
  /** New contacts/enquiries created in the last 7 days. */
  newEnquiriesCount: number;
  /** Wedding tasks due within the next 7 days. */
  upcomingTasks: UpcomingTask[];
  /** Couple portal logins in the last 7 days. */
  recentPortalLogins: number;
  /** Payment milestones due within the next 7 days. */
  upcomingPayments: UpcomingPayment[];
}

function formatAmountMinor(minor: number): string {
  return `£${(minor / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Internal daily brief sent to venue staff at 7am each day.
 * Covers pipeline summary (if GHL is connected), recent enquiries,
 * upcoming tasks, portal activity, and payment milestones due soon.
 */
export function DailyBriefEmail({
  venueName,
  date,
  pipelineCounts,
  newEnquiriesCount,
  upcomingTasks,
  recentPortalLogins,
  upcomingPayments,
}: DailyBriefEmailProps) {
  const hasPipeline = pipelineCounts && pipelineCounts.length > 0;
  const totalPipelineValue = hasPipeline
    ? pipelineCounts!.reduce((sum, s) => sum + s.totalValue, 0)
    : 0;
  const totalPipelineCount = hasPipeline
    ? pipelineCounts!.reduce((sum, s) => sum + s.count, 0)
    : 0;

  return (
    <Html>
      <Head />
      <Preview>Your daily brief — {venueName} · {date}</Preview>
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
          {/* Header */}
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
              {venueName} · Daily Brief
            </Text>
            <Heading
              style={{
                color: NAVY,
                fontSize: "24px",
                lineHeight: 1.2,
                fontWeight: 700,
                margin: "0 0 4px",
              }}
            >
              Good morning
            </Heading>
            <Text style={{ color: MUTED, fontSize: "14px", margin: "0 0 24px" }}>
              {date}
            </Text>
          </Section>

          <Hr style={{ borderColor: "#E6E6EC", margin: "0 0 24px" }} />

          {/* Pipeline at a glance (GHL only) */}
          {hasPipeline && (
            <Section style={{ marginBottom: "24px" }}>
              <Text
                style={{
                  color: NAVY,
                  fontSize: "13px",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  margin: "0 0 12px",
                }}
              >
                Pipeline at a glance
              </Text>
              <Text style={{ color: NAVY, fontSize: "15px", margin: "0 0 4px" }}>
                <strong>{totalPipelineCount}</strong> open opportunities
                {totalPipelineValue > 0 && (
                  <> — <strong>{formatAmountMinor(totalPipelineValue)}</strong> in pipeline</>
                )}
              </Text>
              {pipelineCounts!.map((stage) => (
                <Text
                  key={stage.pipelineStageId}
                  style={{ color: MUTED, fontSize: "13px", margin: "2px 0" }}
                >
                  Stage {stage.pipelineStageId}: {stage.count} opp
                  {stage.count !== 1 ? "s" : ""}
                  {stage.totalValue > 0 && ` · ${formatAmountMinor(stage.totalValue)}`}
                </Text>
              ))}
            </Section>
          )}

          {/* New enquiries */}
          <Section style={{ marginBottom: "24px" }}>
            <Text
              style={{
                color: NAVY,
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                margin: "0 0 12px",
              }}
            >
              New enquiries (last 7 days)
            </Text>
            <Text style={{ color: NAVY, fontSize: "15px", margin: 0 }}>
              <strong>{newEnquiriesCount}</strong> new contact
              {newEnquiriesCount !== 1 ? "s" : ""} in the last 7 days
            </Text>
          </Section>

          <Hr style={{ borderColor: "#E6E6EC", margin: "0 0 24px" }} />

          {/* Upcoming tasks */}
          <Section style={{ marginBottom: "24px" }}>
            <Text
              style={{
                color: NAVY,
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                margin: "0 0 12px",
              }}
            >
              Tasks due this week
            </Text>
            {upcomingTasks.length === 0 ? (
              <Text style={{ color: MUTED, fontSize: "14px", margin: 0 }}>
                No tasks due in the next 7 days.
              </Text>
            ) : (
              upcomingTasks.map((task) => (
                <Text
                  key={task.id}
                  style={{ color: NAVY, fontSize: "14px", margin: "0 0 4px" }}
                >
                  {task.due_date ? `${task.due_date} — ` : ""}
                  {task.title}
                </Text>
              ))
            )}
          </Section>

          <Hr style={{ borderColor: "#E6E6EC", margin: "0 0 24px" }} />

          {/* Portal activity */}
          <Section style={{ marginBottom: "24px" }}>
            <Text
              style={{
                color: NAVY,
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                margin: "0 0 12px",
              }}
            >
              Portal activity (last 7 days)
            </Text>
            <Text style={{ color: NAVY, fontSize: "15px", margin: 0 }}>
              <strong>{recentPortalLogins}</strong> couple portal login
              {recentPortalLogins !== 1 ? "s" : ""}
            </Text>
          </Section>

          {/* Upcoming payments */}
          {upcomingPayments.length > 0 && (
            <>
              <Hr style={{ borderColor: "#E6E6EC", margin: "0 0 24px" }} />
              <Section style={{ marginBottom: "24px" }}>
                <Text
                  style={{
                    color: NAVY,
                    fontSize: "13px",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    margin: "0 0 12px",
                  }}
                >
                  Payments due this week
                </Text>
                {upcomingPayments.map((pm) => (
                  <Text
                    key={pm.id}
                    style={{ color: NAVY, fontSize: "14px", margin: "0 0 4px" }}
                  >
                    {pm.due_date} — {pm.label}:{" "}
                    <strong>{formatAmountMinor(pm.amount_minor)}</strong>
                  </Text>
                ))}
              </Section>
            </>
          )}

          <Hr style={{ borderColor: "#E6E6EC", margin: "32px 0 16px" }} />

          {/* Footer */}
          <Text
            style={{
              color: MUTED,
              fontSize: "12px",
              margin: 0,
              backgroundColor: PINK,
              borderRadius: "6px",
              padding: "8px 12px",
              display: "inline-block",
            }}
          >
            Sent by VenueFlow · Daily brief for {venueName}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default DailyBriefEmail;
