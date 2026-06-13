import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Button,
  Hr,
  Preview,
} from "@react-email/components";

// Brand colours — same palette as brochure-email.tsx
const NAVY = "#101833";
const PINK = "#F6D1FF";
const BG = "#F4F4F7";
const CARD = "#FFFFFF";
const MUTED = "#5B6175";

export interface BookingConfirmationEmailProps {
  venueName: string;
  recipientName: string;
  /** Human-readable date/time in venue timezone, e.g. "Monday 13 July · 10:00" */
  appointmentDisplay: string;
  /** Meeting type label, e.g. "Venue viewing" or "Discovery call" */
  meetingTypeLabel: string;
  /** Full URL to the manage page, e.g. https://app.venueflow.io/book/manage/[token] */
  manageUrl: string;
  isReminder?: boolean;
}

export function BookingConfirmationEmail({
  venueName,
  recipientName,
  appointmentDisplay,
  meetingTypeLabel,
  manageUrl,
  isReminder = false,
}: BookingConfirmationEmailProps) {
  const subject = isReminder
    ? `Reminder: your ${meetingTypeLabel} tomorrow`
    : `Your ${meetingTypeLabel} is confirmed`;

  const headline = isReminder
    ? `See you tomorrow`
    : `Booking confirmed`;

  const bodyText = isReminder
    ? `This is a friendly reminder about your ${meetingTypeLabel.toLowerCase()} with ${venueName} tomorrow.`
    : `Thank you for booking, ${recipientName}. We are looking forward to meeting you.`;

  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
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
            maxWidth: "520px",
            margin: "0 auto",
            padding: "40px",
          }}
        >
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
                fontSize: "26px",
                lineHeight: 1.2,
                fontWeight: 700,
                margin: "0 0 24px",
              }}
            >
              {headline}
            </Heading>

            <Text
              style={{
                color: NAVY,
                fontSize: "16px",
                lineHeight: 1.6,
                margin: "0 0 16px",
              }}
            >
              {bodyText}
            </Text>

            {/* Appointment detail box */}
            <Section
              style={{
                backgroundColor: BG,
                borderRadius: "8px",
                padding: "16px 20px",
                margin: "0 0 24px",
              }}
            >
              <Text
                style={{
                  color: MUTED,
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  margin: "0 0 4px",
                }}
              >
                {meetingTypeLabel}
              </Text>
              <Text
                style={{
                  color: NAVY,
                  fontSize: "18px",
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                {appointmentDisplay}
              </Text>
            </Section>

            <Button
              href={manageUrl}
              style={{
                backgroundColor: PINK,
                color: NAVY,
                fontSize: "15px",
                fontWeight: 600,
                borderRadius: "10px",
                padding: "12px 24px",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Manage booking
            </Button>

            <Text
              style={{
                color: MUTED,
                fontSize: "13px",
                lineHeight: 1.6,
                margin: "20px 0 0",
              }}
            >
              Need to cancel or reschedule? Use the link above any time before
              your appointment.
            </Text>
          </Section>

          <Hr style={{ borderColor: "#E6E6EC", margin: "32px 0 16px" }} />
          <Text style={{ color: MUTED, fontSize: "12px", margin: 0 }}>
            Sent by {venueName}, powered by VenueFlow.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default BookingConfirmationEmail;
