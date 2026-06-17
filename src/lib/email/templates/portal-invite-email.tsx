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

// Brand colours — same palette as other VenueFlow email templates.
const NAVY = "#101833";
const PINK = "#F6D1FF";
const BG = "#F4F4F7";
const CARD = "#FFFFFF";
const MUTED = "#5B6175";

export interface PortalInviteEmailProps {
  venueName: string;
  recipientName?: string | null;
  coupleNames: string;
  portalUrl: string;
}

/**
 * Sent to the couple when a GHL opportunity is marked WON and VenueFlow
 * creates their wedding workspace. The call-to-action takes them to the
 * couple portal where they can activate their account.
 */
export function PortalInviteEmail({
  venueName,
  recipientName,
  coupleNames,
  portalUrl,
}: PortalInviteEmailProps) {
  const greeting = recipientName ? `Hi ${recipientName},` : "Hi there,";

  return (
    <Html>
      <Head />
      <Preview>Your wedding planning portal is ready — {venueName}</Preview>
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
                margin: "0 0 16px",
              }}
            >
              Your wedding portal is ready
            </Heading>

            <Text
              style={{
                color: NAVY,
                fontSize: "16px",
                lineHeight: 1.6,
                margin: "0 0 12px",
              }}
            >
              {greeting}
            </Text>
            <Text
              style={{
                color: NAVY,
                fontSize: "16px",
                lineHeight: 1.6,
                margin: "0 0 24px",
              }}
            >
              Congratulations — we are so excited to celebrate <strong>{coupleNames}</strong>{" "}
              with you at {venueName}. Your personal planning portal is now live. Use it to
              track your wedding details, coordinate with our team, and manage everything
              leading up to your big day.
            </Text>

            <Button
              href={portalUrl}
              style={{
                backgroundColor: PINK,
                color: NAVY,
                fontSize: "16px",
                fontWeight: 600,
                borderRadius: "10px",
                padding: "14px 28px",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Open your planning portal
            </Button>

            <Text
              style={{
                color: MUTED,
                fontSize: "14px",
                lineHeight: 1.6,
                margin: "24px 0 0",
              }}
            >
              Have a question? Simply reply to this email and your coordinator will be in touch.
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

export default PortalInviteEmail;
