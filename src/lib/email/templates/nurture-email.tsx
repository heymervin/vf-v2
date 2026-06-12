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

// Brand colours — same palette as brochure-email.tsx
const NAVY = "#101833";
const BG = "#F4F4F7";
const CARD = "#FFFFFF";
const MUTED = "#5B6175";

export interface NurtureEmailProps {
  venueName: string;
  /** Pre-substituted body text (merge tags already replaced server-side). */
  body: string;
  subject: string;
}

/**
 * Generic nurture step email. Body is plain text (newlines → paragraphs).
 * Merge-tag substitution ({{first_name}} etc.) must happen before rendering.
 */
export function NurtureEmail({ venueName, body, subject }: NurtureEmailProps) {
  // Split on double-newline for paragraphs; single newlines become <br />.
  const paragraphs = body.split(/\n{2,}/);

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
                fontSize: "22px",
                lineHeight: 1.2,
                fontWeight: 700,
                margin: "0 0 24px",
              }}
            >
              {subject}
            </Heading>

            {paragraphs.map((para, i) => (
              <Text
                key={i}
                style={{
                  color: NAVY,
                  fontSize: "16px",
                  lineHeight: 1.6,
                  margin: "0 0 16px",
                  whiteSpace: "pre-line",
                }}
              >
                {para}
              </Text>
            ))}
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

export default NurtureEmail;
