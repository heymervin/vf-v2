import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { healthPing } from "@/inngest/functions/health";
import { leadCaptured } from "@/inngest/functions/lead-captured";
import { sequenceRun } from "@/inngest/functions/sequence-run";

// Add Inngest functions here as they are created.
const functions: Parameters<typeof serve>[0]["functions"] = [
  healthPing,
  leadCaptured,
  sequenceRun,
];

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
