import { inngest } from "@/inngest/client";

// Minimal function so the app registers with Inngest and gives us an
// end-to-end smoke test for the event pipeline.
export const healthPing = inngest.createFunction(
  { id: "health-ping", triggers: { event: "app/health.ping" } },
  async ({ event }) => {
    return { pong: true, receivedAt: event.ts };
  },
);
