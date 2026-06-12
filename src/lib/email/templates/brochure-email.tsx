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

// Brand colours as hex (email clients don't support oklch). Sourced from the
// TWM "Pulse" palette in DESIGN.md: navy #101833, pulse pink #F6D1FF.
const NAVY = "#101833";
const PINK = "#F6D1FF";
const BG = "#F4F4F7";
const CARD = "#FFFFFF";
const MUTED = "#5B6175";

export interface BrochureEmailProps {
  venueName: string;
  recipientName?: string | null;
  brochureUrl: string;
}

export function BrochureEmail({
  venueName,
  recipientName,
  brochureUrl,
}: BrochureEmailProps) {
  const greeting = recipientName ? `Hi ${recipientName},` : "Hi there,";

  return (
    <Html>
      <Head />
      <Preview>Your {venueName} brochure is ready</Preview>
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
              Your brochure is ready
            </Heading>
            <Text style={{ color: NAVY, fontSize: "16px", lineHeight: 1.6, margin: "0 0 12px" }}>
              {greeting}
            </Text>
            <Text style={{ color: NAVY, fontSize: "16px", lineHeight: 1.6, margin: "0 0 24px" }}>
              Thank you for your interest in {venueName}. We would love to help
              you celebrate your wedding with us. Here is everything you need to
              start planning, including our spaces, capacities, and pricing.
            </Text>

            <Button
              href={brochureUrl}
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
              Download the brochure
            </Button>

            <Text style={{ color: MUTED, fontSize: "14px", lineHeight: 1.6, margin: "24px 0 0" }}>
              Have a question or want to arrange a viewing? Just reply to this
              email and we will be in touch.
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

export default BrochureEmail;
